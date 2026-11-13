package com.laundry.management.storage;

import static org.junit.jupiter.api.Assertions.*;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.core.sync.RequestBody;

class R2ObjectStorageTest {
    @Test
    void sdkUsesR2RegionAndSendsFixedLengthBodies() throws Exception {
        var uploaded = new AtomicReference<byte[]>();
        var encoding = new AtomicReference<String>();
        var signature = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/invoice-test/synthetic.png", exchange -> {
            try (exchange) {
                switch (exchange.getRequestMethod()) {
                    case "PUT" -> {
                        signature.set(exchange.getRequestHeaders().getFirst("Authorization"));
                        encoding.set(exchange.getRequestHeaders().getFirst("Content-Encoding"));
                        uploaded.set(exchange.getRequestBody().readAllBytes());
                        exchange.sendResponseHeaders(200, -1);
                    }
                    case "GET" -> {
                        byte[] bytes = uploaded.get();
                        exchange.getResponseHeaders().set("Content-Type", "image/png");
                        exchange.sendResponseHeaders(200, bytes.length);
                        exchange.getResponseBody().write(bytes);
                    }
                    case "DELETE" -> {
                        uploaded.set(null);
                        exchange.sendResponseHeaders(204, -1);
                    }
                    default -> exchange.sendResponseHeaders(405, -1);
                }
            }
        });
        server.start();
        try (var client = R2ObjectStorage.client(URI.create("http://127.0.0.1:" + server.getAddress().getPort()),
            "fixture-id", "fixture-secret")) {
            byte[] bytes = {1, 2, 3};
            client.putObject(r -> r.bucket("invoice-test").key("synthetic.png"), RequestBody.fromBytes(bytes));
            assertNull(encoding.get());
            assertTrue(signature.get().contains("/auto/s3/aws4_request"));
            try (var input = client.getObject(r -> r.bucket("invoice-test").key("synthetic.png"))) {
                assertArrayEquals(bytes, input.readAllBytes());
            }
            client.deleteObject(r -> r.bucket("invoice-test").key("synthetic.png"));
            assertNull(uploaded.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void missingConfigNeverFallsBackToLocalStorage() {
        var storage = new R2ObjectStorage(true, "", "invoice-test", "", "", "");
        assertFalse(storage.ready());
        var problem = assertThrows(ApiException.class, () -> storage.open("synthetic.png"));
        assertEquals(ErrorCode.INVENTORY_INVOICE_STORAGE_NOT_CONFIGURED, problem.getErrorCode());
    }
}
