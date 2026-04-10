package com.tus.orderservice.dto;
import com.tus.orderservice.entity.Customer;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CustomerResponse {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private LocalDateTime createdAt;

    public static CustomerResponse from(Customer customer) {
        CustomerResponse dto = new CustomerResponse();
        dto.id        = customer.getId();
        dto.firstName = customer.getFirstName();
        dto.lastName  = customer.getLastName();
        dto.email     = customer.getEmail();
        dto.createdAt = customer.getCreatedAt();
        return dto;
    }
}
