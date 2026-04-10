package com.tus.orderservice.dto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UpdateOrderStatusRequest {

    @NotNull(message = "Status is required")
    private String status; // CONFIRMED or CANCELLED
}
