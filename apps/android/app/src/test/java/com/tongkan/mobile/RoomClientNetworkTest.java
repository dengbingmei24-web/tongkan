package com.tongkan.mobile;

import org.junit.Test;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;

import javax.net.ssl.SSLHandshakeException;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class RoomClientNetworkTest {
    @Test
    public void explainsCommonMobileNetworkFailures() {
        assertTrue(RoomClient.networkErrorMessage(new UnknownHostException()).startsWith("无法解析"));
        assertTrue(RoomClient.networkErrorMessage(new ConnectException()).startsWith("无法连接"));
        assertTrue(RoomClient.networkErrorMessage(new SocketTimeoutException()).startsWith("连接房间服务器超时"));
        assertTrue(RoomClient.networkErrorMessage(new SSLHandshakeException("certificate")).startsWith("安全连接失败"));
    }

    @Test
    public void keepsUnexpectedExceptionTypeForDiagnosis() {
        assertEquals("网络异常：IllegalStateException · boom", RoomClient.networkErrorMessage(new IllegalStateException("boom")));
    }
}
