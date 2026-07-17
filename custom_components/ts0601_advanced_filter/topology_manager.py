"""Topology Manager for TS0601 Advanced Presence Filter."""
import logging
from datetime import datetime, timedelta

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

class TopologyManager:
    """Manages spatial relationships and handovers between sensors."""
    
    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self._links = {}  # Format: source_entity: [(dest_entity, source_range, dest_range)]
        self._last_departures = {} # Format: entity_id: (timestamp, distance)
        
    def add_link(self, source_entity: str, dest_entity: str, source_range: tuple[float, float], dest_range: tuple[float, float]):
        """Add a spatial link between two sensors."""
        if source_entity not in self._links:
            self._links[source_entity] = []
        self._links[source_entity].append((dest_entity, source_range, dest_range))
        _LOGGER.debug(f"Topology link added: {source_entity} {source_range} -> {dest_entity} {dest_range}")

    def register_departure(self, entity_id: str, distance: float):
        """Register that a target has left a sensor's view at a specific distance."""
        self._last_departures[entity_id] = (datetime.now(), distance)
        _LOGGER.debug(f"Departure registered: {entity_id} at {distance}m")

    def validate_handover(self, dest_entity: str, appearance_distance: float, max_time_window_seconds: int = 5) -> bool:
        """Check if an appearance can be validated by a recent departure from a linked sensor."""
        now = datetime.now()
        
        # Check all sensors that might link to dest_entity
        for source_entity, links in self._links.items():
            for link_dest, source_range, dest_range in links:
                if link_dest == dest_entity:
                    # Check if the appearance distance is within the expected destination range
                    if dest_range[0] <= appearance_distance <= dest_range[1]:
                        # Check if there was a recent departure from the source entity
                        if source_entity in self._last_departures:
                            dep_time, dep_distance = self._last_departures[source_entity]
                            
                            # Check time window
                            if now - dep_time <= timedelta(seconds=max_time_window_seconds):
                                # Check if departure distance was within the source range of the link
                                if source_range[0] <= dep_distance <= source_range[1]:
                                    _LOGGER.info(f"Handover validated: {source_entity} -> {dest_entity}")
                                    return True
        return False
