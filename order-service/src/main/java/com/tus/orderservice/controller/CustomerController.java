package com.tus.orderservice.controller;


import com.tus.orderservice.dto.*;
import com.tus.orderservice.service.*;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;
    private final OrderService    orderService;

    public CustomerController(CustomerService customerService,
                              OrderService orderService) {
        this.customerService = customerService;
        this.orderService    = orderService;
    }

    /** POST /api/customers — Create a new customer */
    @PostMapping
    public ResponseEntity<CustomerResponse> createCustomer(
            @Valid @RequestBody CreateCustomerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(customerService.createCustomer(request));
    }

    /** GET /api/customers/{id} — Get a single customer */
    @GetMapping("/{id}")
    public ResponseEntity<CustomerResponse> getCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getCustomerById(id));
    }

    /**
     * GET /api/customers?page=0&size=10
     * Params: page (default 0), size (default 10)
     * Response: data, page, size, totalElements, totalPages
     */
    @GetMapping
    public ResponseEntity<PagedResponse<CustomerResponse>> getAllCustomers(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(customerService.getAllCustomers(page, size));
    }

    /** PUT /api/customers/{id} — Update a customer */
    @PutMapping("/{id}")
    public ResponseEntity<CustomerResponse> updateCustomer(
            @PathVariable Long id,
            @Valid @RequestBody CreateCustomerRequest request) {
        return ResponseEntity.ok(customerService.updateCustomer(id, request));
    }

    /** DELETE /api/customers/{id} — Delete a customer */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCustomer(@PathVariable Long id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/customers/{customerId}/orders?page=0&size=10 */
    @GetMapping("/{customerId}/orders")
    public ResponseEntity<PagedResponse<OrderResponse>> getOrdersByCustomer(
            @PathVariable Long customerId,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(
                orderService.getOrdersByCustomer(customerId, page, size));
    }
}