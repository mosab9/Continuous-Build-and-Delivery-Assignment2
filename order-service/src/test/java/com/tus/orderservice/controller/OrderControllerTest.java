package com.tus.orderservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tus.orderservice.dto.*;
import com.tus.orderservice.exception.*;
import com.tus.orderservice.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class OrderControllerTest {

    private MockMvc mockMvc;

    private ObjectMapper objectMapper;

    @Mock
    private OrderService orderService;

    @InjectMocks
    private OrderController orderController;

    private OrderResponse orderResponse;
    private CreateOrderRequest createOrderRequest;
    private OrderItemRequest orderItemRequest;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(orderController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        OrderItemResponse itemResponse = new OrderItemResponse();
        itemResponse.setId(1L);
        itemResponse.setProductId(100L);
        itemResponse.setProductName("Test Product");
        itemResponse.setQuantity(2);
        itemResponse.setUnitPrice(new BigDecimal("25.00"));
        itemResponse.setSubtotal(new BigDecimal("50.00"));

        orderResponse = new OrderResponse();
        orderResponse.setId(1L);
        orderResponse.setCustomerName("John Doe");
        orderResponse.setStatus("PENDING");
        orderResponse.setTotalPrice(new BigDecimal("50.00"));
        orderResponse.setCreatedAt(LocalDateTime.now());
        orderResponse.setUpdatedAt(LocalDateTime.now());
        orderResponse.setItems(List.of(itemResponse));

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
    @DisplayName("POST /api/orders")
    class CreateOrderTests {

        @Test
        @DisplayName("Should create order and return 201 Created")
        void createOrder_WithValidRequest_Returns201() throws Exception {
            when(orderService.createOrder(any(CreateOrderRequest.class))).thenReturn(orderResponse);

            mockMvc.perform(post("/api/orders")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createOrderRequest)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value(1))
                    .andExpect(jsonPath("$.customerName").value("John Doe"))
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andExpect(jsonPath("$.totalPrice").value(50.00))
                    .andExpect(jsonPath("$.items", hasSize(1)));

            verify(orderService).createOrder(any(CreateOrderRequest.class));
        }

        @Test
        @DisplayName("Should return 404 when customer not found")
        void createOrder_WhenCustomerNotFound_Returns404() throws Exception {
            when(orderService.createOrder(any(CreateOrderRequest.class)))
                    .thenThrow(new ResourceNotFoundException("Customer", 1L));

            mockMvc.perform(post("/api/orders")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createOrderRequest)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("GET /api/orders/{id}")
    class GetOrderByIdTests {

        @Test
        @DisplayName("Should return order when found")
        void getOrder_WhenExists_Returns200() throws Exception {
            when(orderService.getOrderById(1L)).thenReturn(orderResponse);

            mockMvc.perform(get("/api/orders/{id}", 1L))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(1))
                    .andExpect(jsonPath("$.customerName").value("John Doe"))
                    .andExpect(jsonPath("$.status").value("PENDING"));

            verify(orderService).getOrderById(1L);
        }

        @Test
        @DisplayName("Should return 404 when order not found")
        void getOrder_WhenNotFound_Returns404() throws Exception {
            when(orderService.getOrderById(99L))
                    .thenThrow(new ResourceNotFoundException("Order", 99L));

            mockMvc.perform(get("/api/orders/{id}", 99L))
                    .andExpect(status().isNotFound());

            verify(orderService).getOrderById(99L);
        }
    }

    @Nested
    @DisplayName("GET /api/orders")
    class GetAllOrdersTests {

        @Test
        @DisplayName("Should return paginated orders with default pagination")
        void getAllOrders_WithDefaultPagination_Returns200() throws Exception {
            PagedResponse<OrderResponse> pagedResponse = PagedResponse.of(
                    List.of(orderResponse), 0, 10, 1L);

            when(orderService.getAllOrders(0, 10)).thenReturn(pagedResponse);

            mockMvc.perform(get("/api/orders"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)))
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.size").value(10))
                    .andExpect(jsonPath("$.totalElements").value(1));

            verify(orderService).getAllOrders(0, 10);
        }

        @Test
        @DisplayName("Should return paginated orders with custom pagination")
        void getAllOrders_WithCustomPagination_Returns200() throws Exception {
            PagedResponse<OrderResponse> pagedResponse = PagedResponse.of(
                    List.of(orderResponse), 2, 25, 51L);

            when(orderService.getAllOrders(2, 25)).thenReturn(pagedResponse);

            mockMvc.perform(get("/api/orders")
                            .param("page", "2")
                            .param("size", "25"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.page").value(2))
                    .andExpect(jsonPath("$.size").value(25));

            verify(orderService).getAllOrders(2, 25);
        }

        @Test
        @DisplayName("Should return empty page when no orders")
        void getAllOrders_WhenNoOrders_ReturnsEmptyPage() throws Exception {
            PagedResponse<OrderResponse> emptyResponse = PagedResponse.of(
                    List.of(), 0, 10, 0L);

            when(orderService.getAllOrders(0, 10)).thenReturn(emptyResponse);

            mockMvc.perform(get("/api/orders"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(0)))
                    .andExpect(jsonPath("$.totalElements").value(0));
        }
    }

    @Nested
    @DisplayName("PUT /api/orders/{id}")
    class UpdateOrderTests {

        @Test
        @DisplayName("Should update order and return 200")
        void updateOrder_WithValidRequest_Returns200() throws Exception {
            orderResponse.setStatus("PENDING");
            when(orderService.updateOrder(eq(1L), any(CreateOrderRequest.class)))
                    .thenReturn(orderResponse);

            mockMvc.perform(put("/api/orders/{id}", 1L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createOrderRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(1))
                    .andExpect(jsonPath("$.status").value("PENDING"));

            verify(orderService).updateOrder(eq(1L), any(CreateOrderRequest.class));
        }

        @Test
        @DisplayName("Should return 404 when order not found")
        void updateOrder_WhenOrderNotFound_Returns404() throws Exception {
            when(orderService.updateOrder(eq(99L), any(CreateOrderRequest.class)))
                    .thenThrow(new ResourceNotFoundException("Order", 99L));

            mockMvc.perform(put("/api/orders/{id}", 99L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createOrderRequest)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("Should return 400 when updating cancelled order")
        void updateOrder_WhenOrderCancelled_Returns400() throws Exception {
            when(orderService.updateOrder(eq(1L), any(CreateOrderRequest.class)))
                    .thenThrow(new InvalidOrderStateException("Cannot update a cancelled order"));

            mockMvc.perform(put("/api/orders/{id}", 1L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createOrderRequest)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("PATCH /api/orders/{id}/status")
    class UpdateOrderStatusTests {

        @Test
        @DisplayName("Should update status to CONFIRMED and return 200")
        void updateOrderStatus_ToConfirmed_Returns200() throws Exception {
            UpdateOrderStatusRequest statusRequest = new UpdateOrderStatusRequest();
            statusRequest.setStatus("CONFIRMED");

            orderResponse.setStatus("CONFIRMED");
            when(orderService.updateOrderStatus(eq(1L), any(UpdateOrderStatusRequest.class)))
                    .thenReturn(orderResponse);

            mockMvc.perform(patch("/api/orders/{id}/status", 1L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(statusRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CONFIRMED"));

            verify(orderService).updateOrderStatus(eq(1L), any(UpdateOrderStatusRequest.class));
        }

        @Test
        @DisplayName("Should update status to CANCELLED and return 200")
        void updateOrderStatus_ToCancelled_Returns200() throws Exception {
            UpdateOrderStatusRequest statusRequest = new UpdateOrderStatusRequest();
            statusRequest.setStatus("CANCELLED");

            orderResponse.setStatus("CANCELLED");
            when(orderService.updateOrderStatus(eq(1L), any(UpdateOrderStatusRequest.class)))
                    .thenReturn(orderResponse);

            mockMvc.perform(patch("/api/orders/{id}/status", 1L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(statusRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"));
        }

        @Test
        @DisplayName("Should return 404 when order not found")
        void updateOrderStatus_WhenOrderNotFound_Returns404() throws Exception {
            UpdateOrderStatusRequest statusRequest = new UpdateOrderStatusRequest();
            statusRequest.setStatus("CONFIRMED");

            when(orderService.updateOrderStatus(eq(99L), any(UpdateOrderStatusRequest.class)))
                    .thenThrow(new ResourceNotFoundException("Order", 99L));

            mockMvc.perform(patch("/api/orders/{id}/status", 99L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(statusRequest)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("Should return 400 when invalid status transition")
        void updateOrderStatus_InvalidTransition_Returns400() throws Exception {
            UpdateOrderStatusRequest statusRequest = new UpdateOrderStatusRequest();
            statusRequest.setStatus("PENDING");

            when(orderService.updateOrderStatus(eq(1L), any(UpdateOrderStatusRequest.class)))
                    .thenThrow(new InvalidOrderStateException("Cannot revert confirmed order"));

            mockMvc.perform(patch("/api/orders/{id}/status", 1L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(statusRequest)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("DELETE /api/orders/{id}")
    class DeleteOrderTests {

        @Test
        @DisplayName("Should delete order and return 204 No Content")
        void deleteOrder_WhenExists_Returns204() throws Exception {
            doNothing().when(orderService).deleteOrder(1L);

            mockMvc.perform(delete("/api/orders/{id}", 1L))
                    .andExpect(status().isNoContent());

            verify(orderService).deleteOrder(1L);
        }

        @Test
        @DisplayName("Should return 404 when order not found")
        void deleteOrder_WhenNotFound_Returns404() throws Exception {
            doThrow(new ResourceNotFoundException("Order", 99L))
                    .when(orderService).deleteOrder(99L);

            mockMvc.perform(delete("/api/orders/{id}", 99L))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("Should return 400 when deleting confirmed order")
        void deleteOrder_WhenConfirmed_Returns400() throws Exception {
            doThrow(new InvalidOrderStateException("Cannot delete a confirmed order"))
                    .when(orderService).deleteOrder(1L);

            mockMvc.perform(delete("/api/orders/{id}", 1L))
                    .andExpect(status().isBadRequest());
        }
    }
}
