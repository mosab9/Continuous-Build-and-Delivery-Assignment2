Feature: Order API Tests

  Background:
    * url baseUrl
    * def ordersPath = '/api/orders'
    * def customersPath = '/api/customers'
    # Generate unique email suffix for each test run
    * def uuid = function(){ return java.util.UUID.randomUUID() + '' }

  @smoke
  Scenario: Create an order successfully
    # First create a customer
    Given path customersPath
    And request { firstName: 'Order', lastName: 'Customer', email: '#("order-create-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    # Create an order
    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [
          {
            "productId": 100,
            "productName": "Product A",
            "quantity": 2,
            "unitPrice": 25.00
          },
          {
            "productId": 101,
            "productName": "Product B",
            "quantity": 3,
            "unitPrice": 10.00
          }
        ]
      }
      """
    When method post
    Then status 201
    And match response.id == '#number'
    And match response.customerName == 'Order Customer'
    And match response.status == 'PENDING'
    And match response.totalPrice == 80.00
    And match response.items == '#[2]'

  Scenario: Create order with non-existent customer returns 404
    Given path ordersPath
    And request
      """
      {
        "customerId": 99999,
        "items": [
          {
            "productId": 100,
            "productName": "Product A",
            "quantity": 1,
            "unitPrice": 10.00
          }
        ]
      }
      """
    When method post
    Then status 404
    And match response.message contains 'Customer'

  Scenario: Create order with empty items returns 400
    # First create a customer
    Given path customersPath
    And request { firstName: 'Empty', lastName: 'Items', email: '#("empty-items-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    # Try to create order with empty items
    Given path ordersPath
    And request { customerId: '#(customerId)', items: [] }
    When method post
    Then status 400

  @smoke
  Scenario: Get order by ID
    # Create customer and order
    Given path customersPath
    And request { firstName: 'GetOrder', lastName: 'Test', email: '#("get-order-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [
          {
            "productId": 100,
            "productName": "Test Product",
            "quantity": 1,
            "unitPrice": 50.00
          }
        ]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id

    # Get the order
    Given path ordersPath, orderId
    When method get
    Then status 200
    And match response.id == orderId
    And match response.customerName == 'GetOrder Test'
    And match response.items[0].productName == 'Test Product'

  Scenario: Get non-existent order returns 404
    Given path ordersPath, 99999
    When method get
    Then status 404
    And match response.status == 404

  @smoke
  Scenario: Get all orders with pagination
    # Create customer and orders
    Given path customersPath
    And request { firstName: 'AllOrders', lastName: 'Test', email: '#("all-orders-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    # Create first order
    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "P1", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201

    # Create second order
    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 2, "productName": "P2", "quantity": 1, "unitPrice": 20.00 }]
      }
      """
    When method post
    Then status 201

    # Get paginated orders
    Given path ordersPath
    And param page = 0
    And param size = 10
    When method get
    Then status 200
    And match response.data == '#array'
    And match response.page == 0
    And match response.totalElements == '#number'

  @smoke
  Scenario: Update order status from PENDING to CONFIRMED
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Status', lastName: 'Update', email: '#("status-update-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Product", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id
    And match response.status == 'PENDING'

    # Update status to CONFIRMED
    Given path ordersPath, orderId, 'status'
    And request { status: 'CONFIRMED' }
    When method patch
    Then status 200
    And match response.status == 'CONFIRMED'

  Scenario: Update order status from PENDING to CANCELLED
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Cancel', lastName: 'Order', email: '#("cancel-order-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Product", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id

    # Update status to CANCELLED
    Given path ordersPath, orderId, 'status'
    And request { status: 'CANCELLED' }
    When method patch
    Then status 200
    And match response.status == 'CANCELLED'

  Scenario: Cannot revert CONFIRMED order to PENDING
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Invalid', lastName: 'Transition', email: '#("invalid-transition-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Product", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id

    # Confirm the order
    Given path ordersPath, orderId, 'status'
    And request { status: 'CONFIRMED' }
    When method patch
    Then status 200

    # Try to revert to PENDING
    Given path ordersPath, orderId, 'status'
    And request { status: 'PENDING' }
    When method patch
    Then status 400
    And match response.message contains 'cannot be reverted'

  Scenario: Cannot update cancelled order
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Cancelled', lastName: 'Update', email: '#("cancelled-update-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Product", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id

    # Cancel the order
    Given path ordersPath, orderId, 'status'
    And request { status: 'CANCELLED' }
    When method patch
    Then status 200

    # Try to update status
    Given path ordersPath, orderId, 'status'
    And request { status: 'CONFIRMED' }
    When method patch
    Then status 400
    And match response.message contains 'cancelled'

  Scenario: Update order items and recalculate total
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Update', lastName: 'Items', email: '#("update-items-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Original", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id
    And match response.totalPrice == 10.00

    # Update the order with new items
    Given path ordersPath, orderId
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 2, "productName": "New Product", "quantity": 5, "unitPrice": 20.00 }]
      }
      """
    When method put
    Then status 200
    And match response.totalPrice == 100.00
    And match response.items[0].productName == 'New Product'

  Scenario: Cannot update cancelled order items
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Cancelled', lastName: 'Items', email: '#("cancelled-items-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Product", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id

    # Cancel the order
    Given path ordersPath, orderId, 'status'
    And request { status: 'CANCELLED' }
    When method patch
    Then status 200

    # Try to update items
    Given path ordersPath, orderId
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 2, "productName": "New", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method put
    Then status 400

  Scenario: Delete pending order successfully
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Delete', lastName: 'Pending', email: '#("delete-pending-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Product", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id

    # Delete the order
    Given path ordersPath, orderId
    When method delete
    Then status 204

    # Verify order is deleted
    Given path ordersPath, orderId
    When method get
    Then status 404

  Scenario: Cannot delete confirmed order
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Delete', lastName: 'Confirmed', email: '#("delete-confirmed-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Product", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id

    # Confirm the order
    Given path ordersPath, orderId, 'status'
    And request { status: 'CONFIRMED' }
    When method patch
    Then status 200

    # Try to delete
    Given path ordersPath, orderId
    When method delete
    Then status 400
    And match response.message contains 'confirmed'

  Scenario: Delete cancelled order successfully
    # Create customer and order
    Given path customersPath
    And request { firstName: 'Delete', lastName: 'Cancelled', email: '#("delete-cancelled-" + uuid() + "@test.com")' }
    When method post
    Then status 201
    * def customerId = response.id

    Given path ordersPath
    And request
      """
      {
        "customerId": #(customerId),
        "items": [{ "productId": 1, "productName": "Product", "quantity": 1, "unitPrice": 10.00 }]
      }
      """
    When method post
    Then status 201
    * def orderId = response.id

    # Cancel the order
    Given path ordersPath, orderId, 'status'
    And request { status: 'CANCELLED' }
    When method patch
    Then status 200

    # Delete the order
    Given path ordersPath, orderId
    When method delete
    Then status 204
