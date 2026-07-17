"""Config flow for TS0601 Advanced Presence Filter integration."""
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    DOMAIN,
    CONF_SOURCE_PRESENCE,
    CONF_SOURCE_DISTANCE,
    CONF_ROOM_MODE,
    CONF_ENTRY_ZONES,
    CONF_BUFFER_TIME,
    ROOM_MODES,
    ROOM_MODE_PASSAGE,
    DEFAULT_BUFFER_TIME,
)

class TS0601AdvancedFilterConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for TS0601 Advanced Presence Filter."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            # Add basic validation if needed
            return self.async_create_entry(title=f"TS0601 Filter: {user_input[CONF_SOURCE_PRESENCE]}", data=user_input)

        data_schema = vol.Schema({
            vol.Required(CONF_SOURCE_PRESENCE): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="binary_sensor")
            ),
            vol.Required(CONF_SOURCE_DISTANCE): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(CONF_ROOM_MODE, default=ROOM_MODE_PASSAGE): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=ROOM_MODES,
                    translation_key="room_mode"
                )
            ),
            vol.Optional(CONF_ENTRY_ZONES, default="0.0-1.5, 4.0-5.0"): str,
            vol.Required(CONF_BUFFER_TIME, default=DEFAULT_BUFFER_TIME): int,
        })

        return self.async_show_form(
            step_id="user", data_schema=data_schema, errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Get the options flow for this handler."""
        return TS0601AdvancedFilterOptionsFlow(config_entry)


class TS0601AdvancedFilterOptionsFlow(config_entries.OptionsFlow):
    """Handle options."""

    def __init__(self, config_entry):
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        data_schema = vol.Schema({
            vol.Required(CONF_ROOM_MODE, default=self.config_entry.data.get(CONF_ROOM_MODE, ROOM_MODE_PASSAGE)): selector.SelectSelector(
                selector.SelectSelectorConfig(options=ROOM_MODES)
            ),
            vol.Optional(CONF_ENTRY_ZONES, default=self.config_entry.data.get(CONF_ENTRY_ZONES, "0.0-1.5, 4.0-5.0")): str,
            vol.Required(CONF_BUFFER_TIME, default=self.config_entry.data.get(CONF_BUFFER_TIME, DEFAULT_BUFFER_TIME)): int,
        })

        return self.async_show_form(step_id="init", data_schema=data_schema)
