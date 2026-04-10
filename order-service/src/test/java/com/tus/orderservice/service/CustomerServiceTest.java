package com.tus.orderservice.service;

import com.tus.orderservice.dto.*;
import com.tus.orderservice.entity.Customer;
import com.tus.orderservice.exception.*;
import com.tus.orderservice.repository.CustomerRepository;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    @Mock
    private CustomerRepository customerRepository;

    @InjectMocks
    private CustomerService customerService;

    private Customer testCustomer;
    private CreateCustomerRequest createCustomerRequest;

    @BeforeEach
    void setUp() {
        testCustomer = Customer.builder()
                .id(1L)
                .firstName("John")
                .lastName("Doe")
                .email("john.doe@example.com")
                .createdAt(LocalDateTime.now())
                .build();

        createCustomerRequest = new CreateCustomerRequest();
        createCustomerRequest.setFirstName("John");
        createCustomerRequest.setLastName("Doe");
        createCustomerRequest.setEmail("john.doe@example.com");
    }

    @Nested
    @DisplayName("createCustomer Tests")
    class CreateCustomerTests {

        @Test
        @DisplayName("Should create customer successfully when email is unique")
        void createCustomer_WithUniqueEmail_ReturnsCustomerResponse() {
            when(customerRepository.existsByEmail("john.doe@example.com")).thenReturn(false);
            when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> {
                Customer customer = invocation.getArgument(0);
                customer.setId(1L);
                customer.setCreatedAt(LocalDateTime.now());
                return customer;
            });

            CustomerResponse response = customerService.createCustomer(createCustomerRequest);

            assertThat(response).isNotNull();
            assertThat(response.getId()).isEqualTo(1L);
            assertThat(response.getFirstName()).isEqualTo("John");
            assertThat(response.getLastName()).isEqualTo("Doe");
            assertThat(response.getEmail()).isEqualTo("john.doe@example.com");

            verify(customerRepository).existsByEmail("john.doe@example.com");
            verify(customerRepository).save(any(Customer.class));
        }

        @Test
        @DisplayName("Should throw DuplicateResourceException when email already exists")
        void createCustomer_WithDuplicateEmail_ThrowsDuplicateResourceException() {
            when(customerRepository.existsByEmail("john.doe@example.com")).thenReturn(true);

            assertThatThrownBy(() -> customerService.createCustomer(createCustomerRequest))
                    .isInstanceOf(DuplicateResourceException.class)
                    .hasMessageContaining("john.doe@example.com")
                    .hasMessageContaining("already exists");

            verify(customerRepository).existsByEmail("john.doe@example.com");
            verify(customerRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should save customer with correct fields")
        void createCustomer_SavesCorrectFields() {
            when(customerRepository.existsByEmail(any())).thenReturn(false);
            when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> {
                Customer customer = invocation.getArgument(0);
                customer.setId(1L);
                customer.setCreatedAt(LocalDateTime.now());
                return customer;
            });

            customerService.createCustomer(createCustomerRequest);

            ArgumentCaptor<Customer> customerCaptor = ArgumentCaptor.forClass(Customer.class);
            verify(customerRepository).save(customerCaptor.capture());

            Customer savedCustomer = customerCaptor.getValue();
            assertThat(savedCustomer.getFirstName()).isEqualTo("John");
            assertThat(savedCustomer.getLastName()).isEqualTo("Doe");
            assertThat(savedCustomer.getEmail()).isEqualTo("john.doe@example.com");
        }
    }

    @Nested
    @DisplayName("getCustomerById Tests")
    class GetCustomerByIdTests {

        @Test
        @DisplayName("Should return customer when found")
        void getCustomerById_WhenCustomerExists_ReturnsCustomerResponse() {
            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));

            CustomerResponse response = customerService.getCustomerById(1L);

            assertThat(response).isNotNull();
            assertThat(response.getId()).isEqualTo(1L);
            assertThat(response.getFirstName()).isEqualTo("John");
            assertThat(response.getLastName()).isEqualTo("Doe");
            assertThat(response.getEmail()).isEqualTo("john.doe@example.com");

            verify(customerRepository).findById(1L);
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when customer not found")
        void getCustomerById_WhenCustomerNotFound_ThrowsResourceNotFoundException() {
            when(customerRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> customerService.getCustomerById(99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Customer")
                    .hasMessageContaining("99");

            verify(customerRepository).findById(99L);
        }
    }

    @Nested
    @DisplayName("getAllCustomers Tests")
    class GetAllCustomersTests {

        @Test
        @DisplayName("Should return paginated customers")
        void getAllCustomers_ReturnsPagedResponse() {
            Customer customer2 = Customer.builder()
                    .id(2L)
                    .firstName("Jane")
                    .lastName("Smith")
                    .email("jane.smith@example.com")
                    .createdAt(LocalDateTime.now())
                    .build();

            Page<Customer> customerPage = new PageImpl<>(
                    List.of(testCustomer, customer2),
                    PageRequest.of(0, 10, Sort.by("createdAt").descending()),
                    2
            );

            when(customerRepository.findAll(any(Pageable.class))).thenReturn(customerPage);

            PagedResponse<CustomerResponse> response = customerService.getAllCustomers(0, 10);

            assertThat(response).isNotNull();
            assertThat(response.getData()).hasSize(2);
            assertThat(response.getPage()).isEqualTo(0);
            assertThat(response.getSize()).isEqualTo(10);
            assertThat(response.getTotalElements()).isEqualTo(2);

            verify(customerRepository).findAll(any(Pageable.class));
        }

        @Test
        @DisplayName("Should return empty page when no customers exist")
        void getAllCustomers_WhenNoCustomers_ReturnsEmptyPage() {
            Page<Customer> emptyPage = new PageImpl<>(
                    List.of(),
                    PageRequest.of(0, 10),
                    0
            );

            when(customerRepository.findAll(any(Pageable.class))).thenReturn(emptyPage);

            PagedResponse<CustomerResponse> response = customerService.getAllCustomers(0, 10);

            assertThat(response.getData()).isEmpty();
            assertThat(response.getTotalElements()).isEqualTo(0);
        }

        @Test
        @DisplayName("Should pass correct pagination parameters")
        void getAllCustomers_PassesCorrectPagination() {
            Page<Customer> customerPage = new PageImpl<>(List.of(testCustomer));

            when(customerRepository.findAll(any(Pageable.class))).thenReturn(customerPage);

            customerService.getAllCustomers(2, 25);

            ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
            verify(customerRepository).findAll(pageableCaptor.capture());

            Pageable pageable = pageableCaptor.getValue();
            assertThat(pageable.getPageNumber()).isEqualTo(2);
            assertThat(pageable.getPageSize()).isEqualTo(25);
            assertThat(pageable.getSort().getOrderFor("createdAt")).isNotNull();
            assertThat(pageable.getSort().getOrderFor("createdAt").getDirection())
                    .isEqualTo(Sort.Direction.DESC);
        }
    }

    @Nested
    @DisplayName("updateCustomer Tests")
    class UpdateCustomerTests {

        @Test
        @DisplayName("Should update customer successfully with same email")
        void updateCustomer_WithSameEmail_Success() {
            CreateCustomerRequest updateRequest = new CreateCustomerRequest();
            updateRequest.setFirstName("Johnny");
            updateRequest.setLastName("Doe Updated");
            updateRequest.setEmail("john.doe@example.com");

            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));
            when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> invocation.getArgument(0));

            CustomerResponse response = customerService.updateCustomer(1L, updateRequest);

            assertThat(response.getFirstName()).isEqualTo("Johnny");
            assertThat(response.getLastName()).isEqualTo("Doe Updated");
            assertThat(response.getEmail()).isEqualTo("john.doe@example.com");

            verify(customerRepository).findById(1L);
            verify(customerRepository).save(any(Customer.class));
            verify(customerRepository, never()).existsByEmail(any());
        }

        @Test
        @DisplayName("Should update customer successfully with new unique email")
        void updateCustomer_WithNewUniqueEmail_Success() {
            CreateCustomerRequest updateRequest = new CreateCustomerRequest();
            updateRequest.setFirstName("John");
            updateRequest.setLastName("Doe");
            updateRequest.setEmail("new.email@example.com");

            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));
            when(customerRepository.existsByEmail("new.email@example.com")).thenReturn(false);
            when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> invocation.getArgument(0));

            CustomerResponse response = customerService.updateCustomer(1L, updateRequest);

            assertThat(response.getEmail()).isEqualTo("new.email@example.com");

            verify(customerRepository).existsByEmail("new.email@example.com");
            verify(customerRepository).save(any(Customer.class));
        }

        @Test
        @DisplayName("Should throw DuplicateResourceException when new email already exists")
        void updateCustomer_WithDuplicateEmail_ThrowsException() {
            CreateCustomerRequest updateRequest = new CreateCustomerRequest();
            updateRequest.setFirstName("John");
            updateRequest.setLastName("Doe");
            updateRequest.setEmail("existing@example.com");

            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));
            when(customerRepository.existsByEmail("existing@example.com")).thenReturn(true);

            assertThatThrownBy(() -> customerService.updateCustomer(1L, updateRequest))
                    .isInstanceOf(DuplicateResourceException.class)
                    .hasMessageContaining("existing@example.com")
                    .hasMessageContaining("already exists");

            verify(customerRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when customer not found")
        void updateCustomer_WhenCustomerNotFound_ThrowsException() {
            when(customerRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> customerService.updateCustomer(99L, createCustomerRequest))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Customer")
                    .hasMessageContaining("99");

            verify(customerRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should update all fields correctly")
        void updateCustomer_UpdatesAllFields() {
            CreateCustomerRequest updateRequest = new CreateCustomerRequest();
            updateRequest.setFirstName("Updated First");
            updateRequest.setLastName("Updated Last");
            updateRequest.setEmail("updated@example.com");

            when(customerRepository.findById(1L)).thenReturn(Optional.of(testCustomer));
            when(customerRepository.existsByEmail("updated@example.com")).thenReturn(false);
            when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> invocation.getArgument(0));

            customerService.updateCustomer(1L, updateRequest);

            ArgumentCaptor<Customer> customerCaptor = ArgumentCaptor.forClass(Customer.class);
            verify(customerRepository).save(customerCaptor.capture());

            Customer savedCustomer = customerCaptor.getValue();
            assertThat(savedCustomer.getFirstName()).isEqualTo("Updated First");
            assertThat(savedCustomer.getLastName()).isEqualTo("Updated Last");
            assertThat(savedCustomer.getEmail()).isEqualTo("updated@example.com");
        }
    }

    @Nested
    @DisplayName("deleteCustomer Tests")
    class DeleteCustomerTests {

        @Test
        @DisplayName("Should delete customer successfully when exists")
        void deleteCustomer_WhenCustomerExists_Success() {
            when(customerRepository.existsById(1L)).thenReturn(true);
            doNothing().when(customerRepository).deleteById(1L);

            customerService.deleteCustomer(1L);

            verify(customerRepository).existsById(1L);
            verify(customerRepository).deleteById(1L);
        }

        @Test
        @DisplayName("Should throw ResourceNotFoundException when customer not found")
        void deleteCustomer_WhenCustomerNotFound_ThrowsException() {
            when(customerRepository.existsById(99L)).thenReturn(false);

            assertThatThrownBy(() -> customerService.deleteCustomer(99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Customer")
                    .hasMessageContaining("99");

            verify(customerRepository).existsById(99L);
            verify(customerRepository, never()).deleteById(anyLong());
        }
    }
}
