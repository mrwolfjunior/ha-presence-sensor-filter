"""Binary sensor platform for TS0601 Advanced Presence Filter."""
import logging
from datetime import datetime, timedelta
from collections import deque

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_state_change_event

from .const import (
    DOMAIN,
    CONF_SOURCE_PRESENCE,
    CONF_SOURCE_DISTANCE,
    CONF_ROOM_MODE,
    CONF_ENTRY_ZONES,
    CONF_BUFFER_TIME,
    ROOM_MODE_PERIMETER,
)

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, config_entry, async_add_entities):
    """Set up the binary sensor from config entry."""
    data = config_entry.data
    
    # Parse entry zones
    entry_zones = []
    if CONF_ENTRY_ZONES in data and data[CONF_ENTRY_ZONES]:
        try:
            zones_str = data[CONF_ENTRY_ZONES].split(',')
            for z in zones_str:
                parts = z.split('-')
                if len(parts) == 2:
                    entry_zones.append((float(parts[0].strip()), float(parts[1].strip())))
        except Exception as e:
            _LOGGER.error(f"Error parsing entry zones: {e}")

    sensor = TS0601AdvancedFilterSensor(
        hass,
        config_entry.entry_id,
        data[CONF_SOURCE_PRESENCE],
        data[CONF_SOURCE_DISTANCE],
        data[CONF_ROOM_MODE],
        entry_zones,
        data[CONF_BUFFER_TIME],
    )
    
    async_add_entities([sensor], True)


class TS0601AdvancedFilterSensor(BinarySensorEntity):
    """Representation of the Filtered Binary Sensor."""

    def __init__(self, hass: HomeAssistant, entry_id, source_presence, source_distance, room_mode, entry_zones, buffer_time):
        """Initialize the sensor."""
        self.hass = hass
        self._entry_id = entry_id
        self._source_presence = source_presence
        self._source_distance = source_distance
        self._room_mode = room_mode
        self._entry_zones = entry_zones
        self._buffer_time = buffer_time
        
        self._attr_name = f"Filtered {source_presence.split('.')[1]}"
        self._attr_unique_id = f"ts0601_filter_{entry_id}"
        self._attr_is_on = False
        
        self._distance_buffer = deque()
        self._direction = "stationary"
        self._filtered_reason = "None"
        
        # Load Blind zones from storage (mocked for now, will be populated by training service)
        self._blind_zones = [] 

    @property
    def extra_state_attributes(self):
        """Return entity specific state attributes."""
        return {
            "direction": self._direction,
            "filtered_reason": self._filtered_reason,
            "source_presence": self._source_presence,
            "source_distance": self._source_distance,
        }

    async def async_added_to_hass(self):
        """Register callbacks."""
        self.async_on_remove(
            async_track_state_change_event(
                self.hass, [self._source_presence, self._source_distance], self._sensor_state_changed
            )
        )

    @callback
    def _sensor_state_changed(self, event):
        """Handle state changes from the source sensors."""
        entity_id = event.data.get("entity_id")
        new_state = event.data.get("new_state")
        
        if new_state is None:
            return

        # Fetch current state of both sensors
        presence_state = self.hass.states.get(self._source_presence)
        distance_state = self.hass.states.get(self._source_distance)
        
        if not presence_state or not distance_state:
            return

        is_present = presence_state.state == "on"
        
        try:
            distance = float(distance_state.state)
        except ValueError:
            return

        now = datetime.now()

        if not is_present:
            # target lost
            if self._attr_is_on:
                # Register departure in topology
                topology = self.hass.data[DOMAIN].get("topology")
                if topology:
                    topology.register_departure(self._attr_unique_id, distance)
                
            self._attr_is_on = False
            self._distance_buffer.clear()
            self._direction = "stationary"
            self.async_write_ha_state()
            return

        # Target is present, add to buffer
        self._distance_buffer.append((now, distance))
        
        # Cleanup old buffer entries
        while self._distance_buffer and (now - self._distance_buffer[0][0]) > timedelta(seconds=self._buffer_time):
            self._distance_buffer.popleft()

        # Update direction
        self._update_direction()

        # Check Blind Zones
        for z_start, z_end in self._blind_zones:
            if z_start <= distance <= z_end:
                self._filtered_reason = "blind_zone"
                self._attr_is_on = False
                self.async_write_ha_state()
                return

        # Determine if we should trigger
        should_trigger = False
        topology = self.hass.data[DOMAIN].get("topology")

        # Check if we have enough buffer data to validate trajectory
        if len(self._distance_buffer) > 1:
            buffer_duration = (self._distance_buffer[-1][0] - self._distance_buffer[0][0]).total_seconds()
            
            # Wasp in a box check for initial appearance
            if self._room_mode == ROOM_MODE_PERIMETER and not self._attr_is_on:
                # Find the initial distance when presence was first detected in this buffer
                initial_distance = self._distance_buffer[0][1]
                
                is_entry_zone = any(z_start <= initial_distance <= z_end for z_start, z_end in self._entry_zones)
                is_handover = False
                
                if topology:
                    is_handover = topology.validate_handover(self._attr_unique_id, initial_distance)

                if not is_entry_zone and not is_handover:
                    self._filtered_reason = "perimeter_violation_no_handover"
                else:
                    self._filtered_reason = "None"
                    
                    # Require at least some continuous movement or time passing to validate
                    # e.g. target must be tracked for at least 3 seconds before confirming
                    if buffer_duration >= 3.0:
                        should_trigger = True
            else:
                # Passage mode or already on
                self._filtered_reason = "None"
                if buffer_duration >= 3.0:
                     should_trigger = True
        
        if should_trigger and not self._attr_is_on:
            self._attr_is_on = True
            
        self.async_write_ha_state()

    def _update_direction(self):
        """Calculate derivative to find direction."""
        if len(self._distance_buffer) < 2:
            self._direction = "stationary"
            return
            
        first_dist = self._distance_buffer[0][1]
        last_dist = self._distance_buffer[-1][1]
        
        diff = last_dist - first_dist
        if diff > 0.3:
            self._direction = "retreating"
        elif diff < -0.3:
            self._direction = "approaching"
        else:
            self._direction = "stationary"
