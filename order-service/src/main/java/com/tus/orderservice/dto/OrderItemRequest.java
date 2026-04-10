package com.tus.orderservice.dto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class OrderItemRequest {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotBlank(message = "Product name is required")
    private String productName;

    @NotNull
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotNull
    @DecimalMin(value = "0.01", message = "Unit price must be greater than 0")
    private BigDecimal unitPrice;
}
