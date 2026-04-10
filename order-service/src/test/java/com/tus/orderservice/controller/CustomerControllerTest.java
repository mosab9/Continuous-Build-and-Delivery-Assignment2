package com.tus.orderservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tus.orderservice.dto.*;
import com.tus.orderservice.exception.*;
import com.tus.orderservice.service.*;
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
class CustomerControllerTest {

    private MockMvc mockMvc;

    private ObjectMapper objectMapper;

    @Mock
    private CustomerService customerService;

    @Mock
    private OrderService orderService;

    @InjectMocks
    private CustomerController customerController;

    private CustomerResponse customerResponse;
    private CreateCustomerRequest createCustomerRequest;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(customerController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        customerResponse = new CustomerResponse();
        customerResponse.setId(1L);
        customerResponse.setFirstName("John");
        customerResponse.setLastName("Doe");
        customerResponse.setEmail("john.doe@example.com");
        customerResponse.setCreatedAt(LocalDateTime.now());

        createCustomerRequest = new CreateCustomerRequest();
        createCustomerRequest.setFirstName("John");
        createCustomerRequest.setLastName("Doe");
        createCustomerRequest.setEmail("john.doe@example.com");
    }

    @Nested
    @DisplayName("POST /api/customers")
    class CreateCustomerTests {

        @Test
        @DisplayName("Should create customer and return 201 Created")
        void createCustomer_WithValidRequest_Returns201() throws Exception {
            when(customerService.createCustomer(any(CreateCustomerRequest.class)))
                    .thenReturn(customerResponse);

            mockMvc.perform(post("/api/customers")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createCustomerRequest)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value(1))
                    .andExpect(jsonPath("$.firstName").value("John"))
                    .andExpect(jsonPath("$.lastName").value("Doe"))
                    .andExpect(jsonPath("$.email").value("john.doe@example.com"));

            verify(customerService).createCustomer(any(CreateCustomerRequest.class));
        }

        @Test
        @DisplayName("Should return 409 when email already exists")
        void createCustomer_WithDuplicateEmail_Returns409() throws Exception {
            when(customerService.createCustomer(any(CreateCustomerRequest.class)))
                    .thenThrow(new DuplicateResourceException("Customer with email john.doe@example.com already exists"));

            mockMvc.perform(post("/api/customers")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createCustomerRequest)))
                    .andExpect(status().isConflict());
        }
    }

    @Nested
    @DisplayName("GET /api/customers/{id}")
    class GetCustomerByIdTests {

        @Test
        @DisplayName("Should return customer when found")
        void getCustomer_WhenExists_Returns200() throws Exception {
            when(customerService.getCustomerById(1L)).thenReturn(customerResponse);

            mockMvc.perform(get("/api/customers/{id}", 1L))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(1))
                    .andExpect(jsonPath("$.firstName").value("John"))
                    .andExpect(jsonPath("$.lastName").value("Doe"))
                    .andExpect(jsonPath("$.email").value("john.doe@example.com"));

            verify(customerService).getCustomerById(1L);
        }

        @Test
        @DisplayName("Should return 404 when customer not found")
        void getCustomer_WhenNotFound_Returns404() throws Exception {
            when(customerService.getCustomerById(99L))
                    .thenThrow(new ResourceNotFoundException("Customer", 99L));

            mockMvc.perform(get("/api/customers/{id}", 99L))
                    .andExpect(status().isNotFound());

            verify(customerService).getCustomerById(99L);
        }
    }

    @Nested
    @DisplayName("GET /api/customers")
    class GetAllCustomersTests {

        @Test
        @DisplayName("Should return paginated customers with default pagination")
        void getAllCustomers_WithDefaultPagination_Returns200() throws Exception {
            PagedResponse<CustomerResponse> pagedResponse = PagedResponse.of(
                    List.of(customerResponse), 0, 10, 1L);

            when(customerService.getAllCustomers(0, 10)).thenReturn(pagedResponse);

            mockMvc.perform(get("/api/customers"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)))
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.size").value(10))
                    .andExpect(jsonPath("$.totalElements").value(1));

            verify(customerService).getAllCustomers(0, 10);
        }

        @Test
        @DisplayName("Should return paginated customers with custom pagination")
        void getAllCustomers_WithCustomPagination_Returns200() throws Exception {
            PagedResponse<CustomerResponse> pagedResponse = PagedResponse.of(
                    List.of(customerResponse), 1, 5, 6L);

            when(customerService.getAllCustomers(1, 5)).thenReturn(pagedResponse);

            mockMvc.perform(get("/api/customers")
                            .param("page", "1")
                            .param("size", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.page").value(1))
                    .andExpect(jsonPath("$.size").value(5));

            verify(customerService).getAllCustomers(1, 5);
        }

        @Test
        @DisplayName("Should return empty page when no customers")
        void getAllCustomers_WhenNoCustomers_ReturnsEmptyPage() throws Exception {
            PagedResponse<CustomerResponse> emptyResponse = PagedResponse.of(
                    List.of(), 0, 10, 0L);

            when(customerService.getAllCustomers(0, 10)).thenReturn(emptyResponse);

            mockMvc.perform(get("/api/customers"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(0)))
                    .andExpect(jsonPath("$.totalElements").value(0));
        }
    }

    @Nested
    @DisplayName("PUT /api/customers/{id}")
    class UpdateCustomerTests {

        @Test
        @DisplayName("Should update customer and return 200")
        void updateCustomer_WithValidRequest_Returns200() throws Exception {
            customerResponse.setFirstName("Johnny");
            customerResponse.setLastName("Updated");
            when(customerService.updateCustomer(eq(1L), any(CreateCustomerRequest.class)))
                    .thenReturn(customerResponse);

            createCustomerRequest.setFirstName("Johnny");
            createCustomerRequest.setLastName("Updated");

            mockMvc.perform(put("/api/customers/{id}", 1L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createCustomerRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.firstName").value("Johnny"))
                    .andExpect(jsonPath("$.lastName").value("Updated"));

            verify(customerService).updateCustomer(eq(1L), any(CreateCustomerRequest.class));
        }

        @Test
        @DisplayName("Should return 404 when customer not found")
        void updateCustomer_WhenNotFound_Returns404() throws Exception {
            when(customerService.updateCustomer(eq(99L), any(CreateCustomerRequest.class)))
                    .thenThrow(new ResourceNotFoundException("Customer", 99L));

            mockMvc.perform(put("/api/customers/{id}", 99L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createCustomerRequest)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("Should return 409 when updating to duplicate email")
        void updateCustomer_WithDuplicateEmail_Returns409() throws Exception {
            createCustomerRequest.setEmail("existing@example.com");
            when(customerService.updateCustomer(eq(1L), any(CreateCustomerRequest.class)))
                    .thenThrow(new DuplicateResourceException("Customer with email existing@example.com already exists"));

            mockMvc.perform(put("/api/customers/{id}", 1L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(createCustomerRequest)))
                    .andExpect(status().isConflict());
        }
    }

    @Nested
    @DisplayName("DELETE /api/customers/{id}")
    class DeleteCustomerTests {

        @Test
        @DisplayName("Should delete customer and return 204 No Content")
        void deleteCustomer_WhenExists_Returns204() throws Exception {
            doNothing().when(customerService).deleteCustomer(1L);

            mockMvc.perform(delete("/api/customers/{id}", 1L))
                    .andExpect(status().isNoContent());

            verify(customerService).deleteCustomer(1L);
        }

        @Test
        @DisplayName("Should return 404 when customer not found")
        void deleteCustomer_WhenNotFound_Returns404() throws Exception {
            doThrow(new ResourceNotFoundException("Customer", 99L))
                    .when(customerService).deleteCustomer(99L);

            mockMvc.perform(delete("/api/customers/{id}", 99L))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("GET /api/customers/{customerId}/orders")
    class GetOrdersByCustomerTests {

        @Test
        @DisplayName("Should return customer orders with default pagination")
        void getOrdersByCustomer_WithDefaultPagination_Returns200() throws Exception {
            OrderItemResponse itemResponse = new OrderItemResponse();
            itemResponse.setId(1L);
            itemResponse.setProductId(100L);
            itemResponse.setProductName("Test Product");
            itemResponse.setQuantity(2);
            itemResponse.setUnitPrice(new BigDecimal("25.00"));
            itemResponse.setSubtotal(new BigDecimal("50.00"));

            OrderResponse orderResponse = new OrderResponse();
            orderResponse.setId(1L);
            orderResponse.setCustomerName("John Doe");
            orderResponse.setStatus("PENDING");
            orderResponse.setTotalPrice(new BigDecimal("50.00"));
            orderResponse.setCreatedAt(LocalDateTime.now());
            orderResponse.setUpdatedAt(LocalDateTime.now());
            orderResponse.setItems(List.of(itemResponse));

            PagedResponse<OrderResponse> pagedResponse = PagedResponse.of(
                    List.of(orderResponse), 0, 10, 1L);

            when(orderService.getOrdersByCustomer(1L, 0, 10)).thenReturn(pagedResponse);

            mockMvc.perform(get("/api/customers/{customerId}/orders", 1L))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)))
                    .andExpect(jsonPath("$.data[0].customerName").value("John Doe"))
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.size").value(10));

            verify(orderService).getOrdersByCustomer(1L, 0, 10);
        }

        @Test
        @DisplayName("Should return customer orders with custom pagination")
        void getOrdersByCustomer_WithCustomPagination_Returns200() throws Exception {
            PagedResponse<OrderResponse> pagedResponse = PagedResponse.of(
                    List.of(), 2, 5, 10L);

            when(orderService.getOrdersByCustomer(1L, 2, 5)).thenReturn(pagedResponse);

            mockMvc.perform(get("/api/customers/{customerId}/orders", 1L)
                            .param("page", "2")
                            .param("size", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.page").value(2))
                    .andExpect(jsonPath("$.size").value(5));

            verify(orderService).getOrdersByCustomer(1L, 2, 5);
        }

        @Test
        @DisplayName("Should return 404 when customer not found")
        void getOrdersByCustomer_WhenCustomerNotFound_Returns404() throws Exception {
            when(orderService.getOrdersByCustomer(99L, 0, 10))
                    .thenThrow(new ResourceNotFoundException("Customer", 99L));

            mockMvc.perform(get("/api/customers/{customerId}/orders", 99L))
                    .andExpect(status().isNotFound());

            verify(orderService).getOrdersByCustomer(99L, 0, 10);
        }

        @Test
        @DisplayName("Should return empty page when customer has no orders")
        void getOrdersByCustomer_WhenNoOrders_ReturnsEmptyPage() throws Exception {
            PagedResponse<OrderResponse> emptyResponse = PagedResponse.of(
                    List.of(), 0, 10, 0L);

            when(orderService.getOrdersByCustomer(1L, 0, 10)).thenReturn(emptyResponse);

            mockMvc.perform(get("/api/customers/{customerId}/orders", 1L))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(0)))
                    .andExpect(jsonPath("$.totalElements").value(0));
        }
    }
}
