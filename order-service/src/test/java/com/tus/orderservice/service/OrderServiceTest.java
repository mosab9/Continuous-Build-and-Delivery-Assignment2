package com.tus.orderservice.service;

import com.tus.orderservice.dto.*;
import com.tus.orderservice.entity.*;
import com.tus.orderservice.exception.*;
import com.tus.orderservice.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private CustomerRepository customerRepository;

    @InjectMocks
    private OrderService orderService;

    private Customer testCustomer;
    private Order testOrder;
    private CreateOrderRequest createOrderRequest;
    private OrderItemRequest orderItemRequest;

    @BeforeEach
    void setUp() {
        testCustomer = Customer.builder()
                .id(1L)
                .firstName("John")
                .lastName("Doe")
                .email("john.doe@example.com")
                .createdAt(LocalDateTime.now())
                .build();

        OrderItem orderItem = OrderItem.builder()
                .id(1L)
                .productId(100L)
                .productName("Test Product")
                .quantity(2)
                .unitPrice(new BigDecimal("25.00"))
                .build();

        testOrder = Order.builder()
                .id(1L)
                .customer(testCustomer)
                .status(OrderStatus.PENDING)
                .totalPrice(new BigDecimal("50.00"))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .items(new ArrayList<>(List.of(orderItem)))
                .build();

        orderItem.setOrder(testOrder);

        orderItemRequest = new OrderItemRequest();
        orderItemRequest.setProductId(100L);
        orderItemRequest.setProductName("Test Product");
        orderItemRequest.setQuantity(2);
        orderItemRequest.setUnitPrice(new BigDecimal("25.00"));

        createOrderRequest = new CreateOrderRequest();
        createOrderRequest.setCustomerId(1L);
        createOrderRequest.setItems(List.of(orderItemRequest));
    }

    @Nested
    @DisplayName("createOrder Tests")
    class CreateOrderTests {

        @Test
        @DisplayName("Should create order successfully when customer exists")
        void createOrder_WithValidRequest_ReturnsOrderResponse() {
            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));
            when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
                Order order = invocation.getArgument(0);
                order.setId(1L);
                order.setCreatedAt(LocalDateTime.now());
                order.setUpdatedAt(LocalDateTime.now());
                order.setStatus(OrderStatus.PENDING);
                return order;
            });

            OrderResponse response = orderService.createOrder(createOrderRequest);

            assertThat(response).isNotNull();
            assertThat(response.getId()).isEqualTo(1L);
            assertThat(response.getCustomerName()).isEqualTo("John Doe");
            assertThat(response.getTotalPrice()).isEqualByComparingTo(new BigDecimal("50.00"));
            assertThat(response.getItems()).hasSize(1);

            verify(customerRepository).findById(1L);
            verify(orderRepository).save(any(Order.class));
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when customer does not exist")
        void createOrder_WithNonExistentCustomer_ThrowsResourceNotFoundException() {
            when(customerRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.createOrder(createOrderRequest))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Customer")
                    .hasMessageContaining("1");

            verify(customerRepository).findById(1L);
            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should calculate total price correctly for multiple items")
        void createOrder_WithMultipleItems_CalculatesTotalCorrectly() {
            OrderItemRequest item2 = new OrderItemRequest();
            item2.setProductId(101L);
            item2.setProductName("Another Product");
            item2.setQuantity(3);
            item2.setUnitPrice(new BigDecimal("10.00"));

            createOrderRequest.setItems(List.of(orderItemRequest, item2));

            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));
            when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
                Order order = invocation.getArgument(0);
                order.setId(1L);
                order.setCreatedAt(LocalDateTime.now());
                order.setUpdatedAt(LocalDateTime.now());
                order.setStatus(OrderStatus.PENDING);
                return order;
            });

            OrderResponse response = orderService.createOrder(createOrderRequest);

            // 2 * 25.00 + 3 * 10.00 = 50.00 + 30.00 = 80.00
            assertThat(response.getTotalPrice()).isEqualByComparingTo(new BigDecimal("80.00"));
            assertThat(response.getItems()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("getOrderById Tests")
    class GetOrderByIdTests {

        @Test
        @DisplayName("Should return order when found")
        void getOrderById_WhenOrderExists_ReturnsOrderResponse() {
            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));

            OrderResponse response = orderService.getOrderById(1L);

            assertThat(response).isNotNull();
            assertThat(response.getId()).isEqualTo(1L);
            assertThat(response.getCustomerName()).isEqualTo("John Doe");
            assertThat(response.getStatus()).isEqualTo("PENDING");

            verify(orderRepository).findById(1L);
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when order not found")
        void getOrderById_WhenOrderNotFound_ThrowsResourceNotFoundException() {
            when(orderRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.getOrderById(99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order")
                    .hasMessageContaining("99");

            verify(orderRepository).findById(99L);
        }
    }

    @Nested
    @DisplayName("getAllOrders Tests")
    class GetAllOrdersTests {

        @Test
        @DisplayName("Should return paginated orders")
        void getAllOrders_ReturnsPagedResponse() {
            Page<Order> orderPage = new PageImpl<>(
                    List.of(testOrder),
                    PageRequest.of(0, 10, Sort.by("createdAt").descending()),
                    1
            );

            when(orderRepository.findAll(any(Pageable.class))).thenReturn(orderPage);

            PagedResponse<OrderResponse> response = orderService.getAllOrders(0, 10);

            assertThat(response).isNotNull();
            assertThat(response.getData()).hasSize(1);
            assertThat(response.getPage()).isEqualTo(0);
            assertThat(response.getSize()).isEqualTo(10);
            assertThat(response.getTotalElements()).isEqualTo(1);

            verify(orderRepository).findAll(any(Pageable.class));
        }

        @Test
        @DisplayName("Should return empty page when no orders exist")
        void getAllOrders_WhenNoOrders_ReturnsEmptyPage() {
            Page<Order> emptyPage = new PageImpl<>(
                    List.of(),
                    PageRequest.of(0, 10),
                    0
            );

            when(orderRepository.findAll(any(Pageable.class))).thenReturn(emptyPage);

            PagedResponse<OrderResponse> response = orderService.getAllOrders(0, 10);

            assertThat(response.getData()).isEmpty();
            assertThat(response.getTotalElements()).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("getOrdersByCustomer Tests")
    class GetOrdersByCustomerTests {

        @Test
        @DisplayName("Should return orders for existing customer")
        void getOrdersByCustomer_WhenCustomerExists_ReturnsOrders() {
            Page<Order> orderPage = new PageImpl<>(List.of(testOrder));

            when(customerRepository.existsById(1L)).thenReturn(true);
            when(orderRepository.findByCustomerId(eq(1L), any(Pageable.class))).thenReturn(orderPage);

            PagedResponse<OrderResponse> response = orderService.getOrdersByCustomer(1L, 0, 10);

            assertThat(response.getData()).hasSize(1);
            assertThat(response.getData().get(0).getCustomerName()).isEqualTo("John Doe");

            verify(customerRepository).existsById(1L);
            verify(orderRepository).findByCustomerId(eq(1L), any(Pageable.class));
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when customer does not exist")
        void getOrdersByCustomer_WhenCustomerNotFound_ThrowsException() {
            when(customerRepository.existsById(99L)).thenReturn(false);

            assertThatThrownBy(() -> orderService.getOrdersByCustomer(99L, 0, 10))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Customer");

            verify(customerRepository).existsById(99L);
            verify(orderRepository, never()).findByCustomerId(anyLong(), any());
        }
    }

    @Nested
    @DisplayName("updateOrderStatus Tests")
    class UpdateOrderStatusTests {

        @Test
        @DisplayName("Should update status from PENDING to CONFIRMED")
        void updateOrderStatus_FromPendingToConfirmed_Success() {
            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("CONFIRMED");

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));
            when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

            OrderResponse response = orderService.updateOrderStatus(1L, request);

            assertThat(response.getStatus()).isEqualTo("CONFIRMED");

            ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
            verify(orderRepository).save(orderCaptor.capture());
            assertThat(orderCaptor.getValue().getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        }

        @Test
        @DisplayName("Should update status from PENDING to CANCELLED")
        void updateOrderStatus_FromPendingToCancelled_Success() {
            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("CANCELLED");

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));
            when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

            OrderResponse response = orderService.updateOrderStatus(1L, request);

            assertThat(response.getStatus()).isEqualTo("CANCELLED");
        }

        @Test
        @DisplayName("Should throw InvalidOrderStateException when updating cancelled order")
        void updateOrderStatus_WhenOrderCancelled_ThrowsException() {
            testOrder.setStatus(OrderStatus.CANCELLED);
            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("CONFIRMED");

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));

            assertThatThrownBy(() -> orderService.updateOrderStatus(1L, request))
                    .isInstanceOf(InvalidOrderStateException.class)
                    .hasMessageContaining("cancelled order");

            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should throw InvalidOrderStateException when reverting confirmed to pending")
        void updateOrderStatus_FromConfirmedToPending_ThrowsException() {
            testOrder.setStatus(OrderStatus.CONFIRMED);
            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("PENDING");

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));

            assertThatThrownBy(() -> orderService.updateOrderStatus(1L, request))
                    .isInstanceOf(InvalidOrderStateException.class)
                    .hasMessageContaining("cannot be reverted");

            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should throw InvalidOrderStateException for invalid status")
        void updateOrderStatus_WithInvalidStatus_ThrowsException() {
            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("INVALID_STATUS");

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));

            assertThatThrownBy(() -> orderService.updateOrderStatus(1L, request))
                    .isInstanceOf(InvalidOrderStateException.class)
                    .hasMessageContaining("Invalid status");

            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when order not found")
        void updateOrderStatus_WhenOrderNotFound_ThrowsException() {
            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("CONFIRMED");

            when(orderRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.updateOrderStatus(99L, request))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order");
        }
    }

    @Nested
    @DisplayName("updateOrder Tests")
    class UpdateOrderTests {

        @Test
        @DisplayName("Should update order successfully")
        void updateOrder_WithValidRequest_Success() {
            OrderItemRequest newItem = new OrderItemRequest();
            newItem.setProductId(200L);
            newItem.setProductName("New Product");
            newItem.setQuantity(5);
            newItem.setUnitPrice(new BigDecimal("20.00"));

            CreateOrderRequest updateRequest = new CreateOrderRequest();
            updateRequest.setCustomerId(1L);
            updateRequest.setItems(List.of(newItem));

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));
            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));
            when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

            OrderResponse response = orderService.updateOrder(1L, updateRequest);

            assertThat(response.getTotalPrice()).isEqualByComparingTo(new BigDecimal("100.00"));

            verify(orderRepository).save(any(Order.class));
        }

        @Test
        @DisplayName("Should throw InvalidOrderStateException when updating cancelled order")
        void updateOrder_WhenOrderCancelled_ThrowsException() {
            testOrder.setStatus(OrderStatus.CANCELLED);

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));
            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));

            assertThatThrownBy(() -> orderService.updateOrder(1L, createOrderRequest))
                    .isInstanceOf(InvalidOrderStateException.class)
                    .hasMessageContaining("cancelled order");

            verify(orderRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when order not found")
        void updateOrder_WhenOrderNotFound_ThrowsException() {
            when(orderRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.updateOrder(99L, createOrderRequest))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order");
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when customer not found")
        void updateOrder_WhenCustomerNotFound_ThrowsException() {
            createOrderRequest.setCustomerId(99L);

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));
            when(customerRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.updateOrder(1L, createOrderRequest))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Customer");
        }
    }

    @Nested
    @DisplayName("deleteOrder Tests")
    class DeleteOrderTests {

        @Test
        @DisplayName("Should delete pending order successfully")
        void deleteOrder_WhenOrderPending_Success() {
            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));
            doNothing().when(orderRepository).deleteById(1L);

            orderService.deleteOrder(1L);

            verify(orderRepository).findById(1L);
            verify(orderRepository).deleteById(1L);
        }

        @Test
        @DisplayName("Should delete cancelled order successfully")
        void deleteOrder_WhenOrderCancelled_Success() {
            testOrder.setStatus(OrderStatus.CANCELLED);

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));
            doNothing().when(orderRepository).deleteById(1L);

            orderService.deleteOrder(1L);

            verify(orderRepository).deleteById(1L);
        }

        @Test
        @DisplayName("Should throw InvalidOrderStateException when deleting confirmed order")
        void deleteOrder_WhenOrderConfirmed_ThrowsException() {
            testOrder.setStatus(OrderStatus.CONFIRMED);

            when(orderRepository.findById(1L)).thenReturn(Optional.of(testOrder));

            assertThatThrownBy(() -> orderService.deleteOrder(1L))
                    .isInstanceOf(InvalidOrderStateException.class)
                    .hasMessageContaining("confirmed order");

            verify(orderRepository, never()).deleteById(anyLong());
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when order not found")
        void deleteOrder_WhenOrderNotFound_ThrowsException() {
            when(orderRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> orderService.deleteOrder(99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Order");

            verify(orderRepository, never()).deleteById(anyLong());
        }
    }
}
