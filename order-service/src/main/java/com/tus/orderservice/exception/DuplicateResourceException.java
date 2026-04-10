package com.tus.orderservice.exception;

// 409 Conflict — duplicate resource
public class DuplicateResourceException extends RuntimeException {
    public DuplicateResourceException(String message) {
        super(message);
    }
}
