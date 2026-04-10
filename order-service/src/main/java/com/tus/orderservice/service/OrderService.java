package com.tus.orderservice.service;


import com.tus.orderservice.dto.*;
import com.tus.orderservice.entity.*;
import com.tus.orderservice.exception.*;
import com.tus.orderservice.repository.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;

    public OrderService(OrderRepository orderRepository,
                        CustomerRepository customerRepository) {
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
    }

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Customer", request.getCustomerId()));

        List<OrderItem> items = new ArrayList<>(request.getItems().stream()
                .map(itemReq -> OrderItem.builder()
                        .productId(itemReq.getProductId())
                        .productName(itemReq.getProductName())
                        .quantity(itemReq.getQuantity())
                        .unitPrice(itemReq.getUnitPrice())
                        .build())
                .toList());

        BigDecimal total = items.stream()
                .map(i -> i.getUnitPrice()
                        .multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Order order = Order.builder()
                .customer(customer)
                .totalPrice(total)
                .items(items)
                .build();

        items.forEach(item -> item.setOrder(order));
        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id));
        return OrderResponse.from(order);
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getAllOrders(int page, int size) {
        Pageable pageable = PageRequest.of(page, size,
                Sort.by("createdAt").descending());
        Page<Order> orderPage = orderRepository.findAll(pageable);
        List<OrderResponse> data = orderPage.getContent().stream()
                .map(OrderResponse::from).toList();
        return PagedResponse.of(data, page, size, orderPage.getTotalElements());
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getOrdersByCustomer(
            Long customerId, int page, int size) {
        if (!customerRepository.existsById(customerId))
            throw new ResourceNotFoundException("Customer", customerId);
        Pageable pageable = PageRequest.of(page, size,
                Sort.by("createdAt").descending());
        Page<Order> orderPage = orderRepository
                .findByCustomerId(customerId, pageable);
        List<OrderResponse> data = orderPage.getContent().stream()
                .map(OrderResponse::from).toList();
        return PagedResponse.of(data, page, size, orderPage.getTotalElements());
    }

    @Transactional
    public OrderResponse updateOrderStatus(Long id,
                                           UpdateOrderStatusRequest request) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id));

        OrderStatus newStatus;
        try {
            newStatus = OrderStatus.valueOf(request.getStatus().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidOrderStateException(
                    "Invalid status: " + request.getStatus());
        }

        if (order.getStatus() == OrderStatus.CANCELLED)
            throw new InvalidOrderStateException(
                    "Cannot update a cancelled order");

        if (order.getStatus() == OrderStatus.CONFIRMED
                && newStatus == OrderStatus.PENDING)
            throw new InvalidOrderStateException(
                    "A confirmed order cannot be reverted to PENDING");

        order.setStatus(newStatus);
        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updateOrder(Long id, CreateOrderRequest request) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id));

        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Customer", request.getCustomerId()));

        // Cannot update cancelled orders
        if (order.getStatus() == OrderStatus.CANCELLED)
            throw new InvalidOrderStateException(
                    "Cannot update a cancelled order");

        List<OrderItem> items = new ArrayList<>(request.getItems().stream()
                .map(itemReq -> OrderItem.builder()
                        .productId(itemReq.getProductId())
                        .productName(itemReq.getProductName())
                        .quantity(itemReq.getQuantity())
                        .unitPrice(itemReq.getUnitPrice())
                        .build())
                .toList());

        BigDecimal total = items.stream()
                .map(i -> i.getUnitPrice()
                        .multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        order.setCustomer(customer);
        order.setTotalPrice(total);
        order.getItems().clear();
        order.getItems().addAll(items);
        order.getItems().forEach(item -> item.setOrder(order));

        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public void deleteOrder(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id));

        if (order.getStatus() == OrderStatus.CONFIRMED)
            throw new InvalidOrderStateException(
                    "Cannot delete a confirmed order");

        orderRepository.deleteById(id);
    }
}