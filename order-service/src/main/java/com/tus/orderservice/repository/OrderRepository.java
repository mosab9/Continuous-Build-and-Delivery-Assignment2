package com.tus.orderservice.repository;

import com.tus.orderservice.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Paginated orders for one customer
    Page<Order> findByCustomerId(Long customerId, Pageable pageable);

    boolean existsByCustomerId(Long customerId);
}
