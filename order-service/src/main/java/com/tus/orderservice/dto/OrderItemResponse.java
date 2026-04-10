package com.tus.orderservice.dto;
import com.tus.orderservice.entity.OrderItem;
import lombok.Data;
import java.math.BigDecimal;


@Data
public class OrderItemResponse {

    private Long id;
    private Long productId;
    private String productName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal subtotal; // computed: quantity x unitPrice

    public static OrderItemResponse from(OrderItem item) {
        OrderItemResponse dto = new OrderItemResponse();
        dto.id          = item.getId();
        dto.productId   = item.getProductId();
        dto.productName = item.getProductName();
        dto.quantity    = item.getQuantity();
        dto.unitPrice   = item.getUnitPrice();
        dto.subtotal    = item.getUnitPrice()
                .multiply(BigDecimal.valueOf(item.getQuantity()));
        return dto;
    }
}
