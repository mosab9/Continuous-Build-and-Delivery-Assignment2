package com.tus.orderservice.dto;

import com.tus.orderservice.entity.Order;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderResponse {

    private Long id;
    private String customerName; // joined — not just customerId
    private String status;
    private BigDecimal totalPrice;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<OrderItemResponse> items;

    public static OrderResponse from(Order order) {
        OrderResponse dto = new OrderResponse();
        dto.id           = order.getId();
        dto.customerName = order.getCustomer().getFirstName()
                + " " + order.getCustomer().getLastName();
        dto.status       = order.getStatus().name();
        dto.totalPrice   = order.getTotalPrice();
        dto.createdAt    = order.getCreatedAt();
        dto.updatedAt    = order.getUpdatedAt();
        dto.items        = order.getItems().stream()
                .map(OrderItemResponse::from)
                .toList();
        return dto;
    }
}
