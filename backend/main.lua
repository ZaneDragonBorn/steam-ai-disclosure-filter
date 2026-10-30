local millennium = require("millennium")
local logger = require("logger")

local function bounded_number(value, maximum)
    if type(value) ~= "number" or value ~= value or value <= 0 then return 0 end
    return math.min(value, maximum)
end

local function validated_app(app, old)
    if type(app) ~= "table" or type(app.appId) ~= "number" or app.appId <= 0
        or app.appId > 4294967295 or app.appId ~= math.floor(app.appId)
        or type(app.title) ~= "string" or type(app.notes) ~= "string" then return nil end
    return {
        appId = app.appId, title = app.title:sub(1, 200), notes = app.notes:sub(1, 10000),
        hidden = app.hidden == true or (old and old.hidden == true) or false,
        reviewCount = bounded_number(app.reviewCount, 4294967295),
        percentPositive = bounded_number(app.percentPositive, 100),
    }
end

-- Config notifications do not reliably reach every already-open Store webview.
-- Reuse the backend lease for a small local policy snapshot (no history/HTTP).
---@ffi
---@return table
function filterState()
    local policy = {}
    for _, key in ipairs({"defaultMode", "discoveryMode", "wishlistMode", "preserveWishlist", "preserveOwned", "showAITags", "showStoreDisclosure", "allowedApps", "phrases", "customFilters", "filterOrder", "debug"}) do
        policy[key] = millennium.config.get(key)
    end
    return policy
end

-- Merge in the backend so different store views cannot overwrite each other's history.
---@ffi
---@param incoming table
---@return boolean
function recordDetected(incoming)
    if type(incoming) ~= "table" or #incoming > 300 then return false end
    local by_id = {}
    local existing = millennium.config.get("detectedApps") or {}
    if type(existing) == "table" then
        for index, app in ipairs(existing) do
            if index > 300 then break end
            local valid = validated_app(app)
            if valid then by_id[valid.appId] = valid end
        end
    end
    for _, app in ipairs(incoming) do
        local valid = validated_app(app)
        if valid then
            local old = by_id[valid.appId]
            valid.hidden = valid.hidden or (old and old.hidden == true) or false
            by_id[valid.appId] = valid
        end
    end
    local apps = {}
    for _, app in pairs(by_id) do apps[#apps + 1] = app end
    table.sort(apps, function(a, b) return (a.reviewCount or 0) > (b.reviewCount or 0) end)
    while #apps > 300 do table.remove(apps) end
    return millennium.config.set("detectedApps", apps)
end

local function on_load()
    if millennium.config.get("defaultMode") == nil then
        millennium.config.set("defaultMode", millennium.config.get("mode") or "off")
    end
    if millennium.config.get("debug") == nil then millennium.config.set("debug", false) end
    if millennium.config.get("discoveryMode") == nil then millennium.config.set("discoveryMode", "off") end
    if millennium.config.get("wishlistMode") == nil then millennium.config.set("wishlistMode", "off") end
    if millennium.config.get("preserveWishlist") == nil then millennium.config.set("preserveWishlist", true) end
    if millennium.config.get("preserveOwned") == nil then millennium.config.set("preserveOwned", false) end
    if millennium.config.get("showAITags") == nil then millennium.config.set("showAITags", true) end
    if millennium.config.get("showStoreDisclosure") == nil then millennium.config.set("showStoreDisclosure", true) end
    -- Retired temporary-reveal state must never suppress Hide Disclosed.
    millennium.config.delete("revealUntil")
    millennium.config.delete("dev.wyatt.ai-disclosure-filter")
    millennium.config.delete("_listingDiagnostic")
    logger:info("AI Disclosure Filter loaded")
    millennium.ready()
end
return {on_load=on_load, on_unload=function() logger:info("AI Disclosure Filter unloaded") end}
