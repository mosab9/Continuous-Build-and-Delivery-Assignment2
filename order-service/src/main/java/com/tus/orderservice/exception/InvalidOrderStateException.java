package com.tus.orderservice.exception;

// 400 Bad Request — invalid state transition
public class InvalidOrderStateException extends RuntimeException {
    public InvalidOrderStateException(String message) {
        super(message);
    }
}