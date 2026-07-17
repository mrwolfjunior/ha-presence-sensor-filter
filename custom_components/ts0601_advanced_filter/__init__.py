"""The TS0601 Advanced Presence Filter integration."""
import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.const import Platform

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.BINARY_SENSOR]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up TS0601 Advanced Presence Filter from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    # Store the config entry
    hass.data[DOMAIN][entry.entry_id] = entry.data
    
    # Inizializzare il topology manager a livello globale se non esiste
    if "topology" not in hass.data[DOMAIN]:
        from .topology_manager import TopologyManager
        hass.data[DOMAIN]["topology"] = TopologyManager(hass)

    async def handle_mark_false_positive(call):
        """Handle the service call to mark a false positive and add a blind zone."""
        entity_id = call.data.get("entity_id")
        _LOGGER.info(f"Marking false positive for {entity_id}")
        
        # In a real implementation, this would look up the specific entity instance,
        # get its current source distance, and persist a new blind zone to storage (e.g. JSON file).
        # We mock this for now.
        sensor_state = hass.states.get(entity_id)
        if sensor_state:
            source_distance = sensor_state.attributes.get("source_distance")
            current_dist_state = hass.states.get(source_distance)
            if current_dist_state:
                try:
                    dist = float(current_dist_state.state)
                    _LOGGER.info(f"Creating blind zone around {dist}m for {entity_id}")
                    # e.g., self._blind_zones.append((dist - 0.2, dist + 0.2))
                except ValueError:
                    pass

    hass.services.async_register(DOMAIN, "mark_false_positive", handle_mark_false_positive)

    # Monitor Alarmo for training notifications
    async def _alarmo_state_changed(event):
        new_state = event.data.get("new_state")
        old_state = event.data.get("old_state")
        
        if new_state and old_state:
            # Check if transitioning to triggered from an armed state
            armed_states = ["armed_away", "armed_night", "armed_custom_bypass"]
            if old_state.state in armed_states and new_state.state == "triggered":
                _LOGGER.info("Alarmo triggered while armed. Sending actionable notification for training.")
                # Look for recently triggered filtered sensors to include in notification
                # Trigger notify.notify with actionable buttons
                # action: "ts0601_mark_fp" -> triggers an automation that calls our service

    hass.bus.async_listen("state_changed", _alarmo_state_changed)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok
