"""Constants for the TS0601 Advanced Presence Filter integration."""

DOMAIN = "ts0601_advanced_filter"

CONF_SOURCE_PRESENCE = "source_presence"
CONF_SOURCE_DISTANCE = "source_distance"
CONF_ROOM_MODE = "room_mode"
CONF_ENTRY_ZONES = "entry_zones"
CONF_BUFFER_TIME = "buffer_time"
CONF_TOPOLOGY_LINKS = "topology_links"

ROOM_MODE_PASSAGE = "passage"
ROOM_MODE_PERIMETER = "perimeter"

ROOM_MODES = [ROOM_MODE_PASSAGE, ROOM_MODE_PERIMETER]

DEFAULT_BUFFER_TIME = 30
