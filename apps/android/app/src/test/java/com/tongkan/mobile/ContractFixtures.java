package com.tongkan.mobile;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

final class ContractFixtures {
    private ContractFixtures() {}

    static JSONObject read(String name) throws Exception {
        InputStream stream = ContractFixtures.class.getClassLoader().getResourceAsStream(name);
        assertNotNull("Missing protocol contract fixture: " + name, stream);
        return new JSONObject(readFully(stream));
    }

    static void assertJsonEquals(Object expected, Object actual) throws Exception {
        if (expected == JSONObject.NULL || actual == JSONObject.NULL) {
            assertEquals(expected, actual);
            return;
        }
        if (expected instanceof JSONObject && actual instanceof JSONObject) {
            JSONObject expectedObject = (JSONObject) expected;
            JSONObject actualObject = (JSONObject) actual;
            assertEquals(keys(expectedObject), keys(actualObject));
            for (String key : keys(expectedObject)) {
                assertJsonEquals(expectedObject.get(key), actualObject.get(key));
            }
            return;
        }
        if (expected instanceof JSONArray && actual instanceof JSONArray) {
            JSONArray expectedArray = (JSONArray) expected;
            JSONArray actualArray = (JSONArray) actual;
            assertEquals(expectedArray.length(), actualArray.length());
            for (int index = 0; index < expectedArray.length(); index += 1) {
                assertJsonEquals(expectedArray.get(index), actualArray.get(index));
            }
            return;
        }
        if (expected instanceof Number && actual instanceof Number) {
            assertEquals(((Number) expected).doubleValue(), ((Number) actual).doubleValue(), 0.0);
            return;
        }
        assertEquals(expected, actual);
    }

    private static Set<String> keys(JSONObject value) {
        Set<String> result = new HashSet<>();
        Iterator<String> iterator = value.keys();
        while (iterator.hasNext()) result.add(iterator.next());
        return result;
    }

    private static String readFully(InputStream stream) throws IOException {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
}
