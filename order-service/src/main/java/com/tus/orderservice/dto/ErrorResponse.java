package com.tus.orderservice.dto;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ErrorResponse {
    private String timestamp;
    private int    status;
    private String error;
    private String message;

    public ErrorResponse(int status, String error, String message) {
        this.timestamp = LocalDateTime.now().toString();
        this.status    = status;
        this.error     = error;
        this.message   = message;
    }
}
