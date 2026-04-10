package com.tus.orderservice.service;


import com.tus.orderservice.dto.*;
import com.tus.orderservice.entity.Customer;
import com.tus.orderservice.exception.*;
import com.tus.orderservice.repository.CustomerRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @Transactional
    public CustomerResponse createCustomer(CreateCustomerRequest request) {
        if (customerRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException(
                    "Customer with email " + request.getEmail() + " already exists");
        }
        Customer customer = Customer.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .build();
        return CustomerResponse.from(customerRepository.save(customer));
    }

    @Transactional(readOnly = true)
    public CustomerResponse getCustomerById(Long id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));
        return CustomerResponse.from(customer);
    }

    @Transactional(readOnly = true)
    public PagedResponse<CustomerResponse> getAllCustomers(int page, int size) {
        Pageable pageable = PageRequest.of(page, size,
                Sort.by("createdAt").descending());
        Page<Customer> customerPage = customerRepository.findAll(pageable);
        List<CustomerResponse> data = customerPage.getContent().stream()
                .map(CustomerResponse::from).toList();
        return PagedResponse.of(data, page, size, customerPage.getTotalElements());
    }

    @Transactional
    public CustomerResponse updateCustomer(Long id, CreateCustomerRequest request) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));

        // Check if new email already exists for another customer
        if (!customer.getEmail().equals(request.getEmail()) &&
                customerRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException(
                    "Customer with email " + request.getEmail() + " already exists");
        }

        customer.setFirstName(request.getFirstName());
        customer.setLastName(request.getLastName());
        customer.setEmail(request.getEmail());
        return CustomerResponse.from(customerRepository.save(customer));
    }

    @Transactional
    public void deleteCustomer(Long id) {
        if (!customerRepository.existsById(id)) {
            throw new ResourceNotFoundException("Customer", id);
        }
        customerRepository.deleteById(id);
    }
}
