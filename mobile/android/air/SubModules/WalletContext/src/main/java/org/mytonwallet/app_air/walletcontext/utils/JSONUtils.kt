package org.mytonwallet.app_air.walletcontext.utils

import org.json.JSONArray
import org.json.JSONObject

val Array<*>.toJSONString: String
    get() {
        val jsonArray = JSONArray()
        for (item in this) {
            jsonArray.put(item);
        }
        return jsonArray.toString()
    }

fun JSONObject.add(json: JSONObject) {
    for (key in json.keys()) {
        put(key, json.get(key))
    }
}
