---
name: spring-boot
description: >
  Spring Boot best practices for Java and Kotlin applications covering project
  structure, REST controllers, JPA, security, and testing. Use this skill when
  building or maintaining Spring Boot backend services.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: backend
  tags: spring, java, kotlin, jpa, boot
---

# Spring Boot Best Practices

## Project Structure

Use a package-by-feature structure, not package-by-layer. Each feature package contains its own controller, service, repository, and DTOs.

```
src/main/java/com/example/app/
  order/
    OrderController.java
    OrderService.java
    OrderRepository.java
    Order.java                # JPA entity
    OrderDto.java             # request/response DTOs
    OrderMapper.java
    OrderNotFoundException.java
  payment/
    PaymentController.java
    PaymentService.java
    PaymentRepository.java
    Payment.java
  user/
    UserController.java
    UserService.java
    UserRepository.java
    User.java
  shared/
    exception/
      GlobalExceptionHandler.java
      ProblemDetail.java
    config/
      SecurityConfig.java
      JpaConfig.java
    BaseEntity.java
  Application.java
```

For hexagonal architecture, separate ports and adapters:

```
src/main/java/com/example/app/
  order/
    domain/
      Order.java              # domain entity (no JPA annotations)
      OrderService.java       # business logic
      OrderRepository.java    # port interface
    adapter/
      in/
        web/
          OrderController.java
          OrderRequest.java
          OrderResponse.java
      out/
        persistence/
          OrderJpaEntity.java
          OrderJpaRepository.java
          OrderRepositoryImpl.java
```

## Dependency Injection

Use constructor injection. Do not use `@Autowired` on fields. Constructor injection makes dependencies explicit and enables testing without a Spring context.

```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final ApplicationEventPublisher eventPublisher;

    // Spring auto-injects when there is a single constructor -- no @Autowired needed
    public OrderService(
            OrderRepository orderRepository,
            PaymentService paymentService,
            ApplicationEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.paymentService = paymentService;
        this.eventPublisher = eventPublisher;
    }
}
```

In Kotlin, use `data class`-style constructors:

```kotlin
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val paymentService: PaymentService,
    private val eventPublisher: ApplicationEventPublisher
) {
    // ...
}
```

## REST Controllers

Use `@RestController`. Return `ResponseEntity` for explicit control over status codes and headers.

```java
@RestController
@RequestMapping("/api/v1/orders")
@Validated
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public ResponseEntity<Page<OrderResponse>> listOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails user) {
        Page<OrderResponse> orders = orderService.getOrdersForUser(user.getUsername(), PageRequest.of(page, size));
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderResponse> getOrder(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        OrderResponse order = orderService.getOrder(id, user.getUsername());
        return ResponseEntity.ok(order);
    }

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            @AuthenticationPrincipal UserDetails user) {
        OrderResponse order = orderService.createOrder(request, user.getUsername());
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(order.id())
                .toUri();
        return ResponseEntity.created(location).body(order);
    }
}
```

Use Java records for DTOs:

```java
public record CreateOrderRequest(
    @NotNull @Size(min = 1) List<OrderItemRequest> items
) {}

public record OrderItemRequest(
    @NotNull Long productId,
    @NotNull @Min(1) Integer quantity
) {}

public record OrderResponse(
    Long id,
    String status,
    BigDecimal totalAmount,
    List<OrderItemResponse> items,
    Instant createdAt
) {}
```

## Service Layer

Annotate service methods with `@Transactional`. Use read-only transactions for queries.

```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final ApplicationEventPublisher eventPublisher;

    public OrderService(OrderRepository orderRepository,
                        ProductRepository productRepository,
                        ApplicationEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> getOrdersForUser(String username, Pageable pageable) {
        return orderRepository.findByCustomerEmail(username, pageable)
                .map(OrderMapper::toResponse);
    }

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request, String username) {
        Order order = new Order();
        order.setCustomerEmail(username);
        order.setStatus(OrderStatus.PENDING);

        BigDecimal total = BigDecimal.ZERO;
        for (OrderItemRequest itemReq : request.items()) {
            Product product = productRepository.findById(itemReq.productId())
                    .orElseThrow(() -> new ProductNotFoundException(itemReq.productId()));

            if (product.getStock() < itemReq.quantity()) {
                throw new InsufficientStockException(product.getName());
            }

            product.setStock(product.getStock() - itemReq.quantity());

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProduct(product);
            item.setQuantity(itemReq.quantity());
            item.setUnitPrice(product.getPrice());
            order.getItems().add(item);

            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(itemReq.quantity())));
        }

        order.setTotalAmount(total);
        Order saved = orderRepository.save(order);

        eventPublisher.publishEvent(new OrderCreatedEvent(saved.getId()));

        return OrderMapper.toResponse(saved);
    }
}
```

## JPA/Hibernate

### Entity Design

Use a mapped superclass for common fields. Set fetch types explicitly.

```java
@MappedSuperclass
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // getters...
}

@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_order_customer_email", columnList = "customerEmail"),
    @Index(name = "idx_order_status", columnList = "status")
})
public class Order extends BaseEntity {
    @Column(nullable = false)
    private String customerEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    // getters, setters...
}

@Entity
@Table(name = "order_items")
public class OrderItem extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)  // always set LAZY on @ManyToOne
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;
}
```

Always set `@ManyToOne(fetch = FetchType.LAZY)`. The default is `EAGER`, which causes N+1 problems. `@OneToMany` defaults to `LAZY`, which is correct.

### Repositories

Use Spring Data JPA repositories. Use JPQL or projections for complex queries.

```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    Page<Order> findByCustomerEmail(String email, Pageable pageable);

    @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") Long id);

    @Query("SELECT o FROM Order o WHERE o.status = :status AND o.createdAt < :cutoff")
    List<Order> findStaleOrders(@Param("status") OrderStatus status, @Param("cutoff") Instant cutoff);

    // Projection for lightweight reads
    @Query("SELECT o.id as id, o.status as status, o.totalAmount as totalAmount FROM Order o WHERE o.customerEmail = :email")
    List<OrderSummary> findSummariesByCustomerEmail(@Param("email") String email);
}

public interface OrderSummary {
    Long getId();
    String getStatus();
    BigDecimal getTotalAmount();
}
```

## Exception Handling with @ControllerAdvice

Centralize exception handling. Return RFC 7807 Problem Details.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(OrderNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Order Not Found");
        problem.setType(URI.create("https://api.example.com/errors/not-found"));
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ProblemDetail> handleInsufficientStock(InsufficientStockException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setTitle("Insufficient Stock");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Validation Failed");

        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
            fieldErrors.put(error.getField(), error.getDefaultMessage())
        );
        problem.setProperty("errors", fieldErrors);

        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneral(Exception ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
        problem.setTitle("Internal Server Error");
        // log the actual exception, do not expose it to the client
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }
}
```

## Validation with Bean Validation

Use `jakarta.validation` annotations on DTOs. Create custom validators for business rules.

```java
public record CreateOrderRequest(
    @NotNull(message = "Items are required")
    @Size(min = 1, message = "At least one item is required")
    List<@Valid OrderItemRequest> items,

    @Size(max = 500, message = "Notes must be under 500 characters")
    String notes
) {}

// Custom validator
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = FutureDateValidator.class)
public @interface FutureBusinessDate {
    String message() default "Must be a future business day";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class FutureDateValidator implements ConstraintValidator<FutureBusinessDate, LocalDate> {
    @Override
    public boolean isValid(LocalDate value, ConstraintValidatorContext context) {
        if (value == null) return true;  // let @NotNull handle null checks
        return value.isAfter(LocalDate.now())
                && value.getDayOfWeek() != DayOfWeek.SATURDAY
                && value.getDayOfWeek() != DayOfWeek.SUNDAY;
    }
}
```

## Spring Security

Configure security with a `SecurityFilterChain` bean. Do not extend `WebSecurityConfigurerAdapter` (deprecated).

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())  // disable for stateless APIs
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

JWT filter implementation:

```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public JwtAuthFilter(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);
        String username = jwtService.extractUsername(token);

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (jwtService.isTokenValid(token, userDetails)) {
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
```

## Testing

### @WebMvcTest for Controller Tests

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
class OrderControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @MockBean
    private JwtService jwtService;

    @Test
    void createOrder_returnsCreated() throws Exception {
        CreateOrderRequest request = new CreateOrderRequest(
            List.of(new OrderItemRequest(1L, 2))
        );
        OrderResponse response = new OrderResponse(1L, "PENDING", new BigDecimal("59.98"), List.of(), Instant.now());

        when(orderService.createOrder(any(), eq("user@example.com"))).thenReturn(response);

        mockMvc.perform(post("/api/v1/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
                .with(jwt().jwt(builder -> builder.subject("user@example.com"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void createOrder_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isUnauthorized());
    }
}
```

### @DataJpaTest for Repository Tests

```java
@DataJpaTest
class OrderRepositoryTest {
    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void findByCustomerEmail_returnsOnlyMatchingOrders() {
        Order order1 = createOrder("alice@example.com");
        Order order2 = createOrder("bob@example.com");
        entityManager.persist(order1);
        entityManager.persist(order2);
        entityManager.flush();

        Page<Order> result = orderRepository.findByCustomerEmail(
            "alice@example.com", PageRequest.of(0, 10));

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getCustomerEmail()).isEqualTo("alice@example.com");
    }
}
```

### @SpringBootTest with Testcontainers

Use Testcontainers for integration tests that need a real database.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class OrderIntegrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void fullOrderLifecycle() {
        // create order
        CreateOrderRequest request = new CreateOrderRequest(
            List.of(new OrderItemRequest(1L, 2))
        );
        ResponseEntity<OrderResponse> createResponse = restTemplate.postForEntity(
            "/api/v1/orders", request, OrderResponse.class);

        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(createResponse.getBody().status()).isEqualTo("PENDING");

        // fetch order
        Long orderId = createResponse.getBody().id();
        ResponseEntity<OrderResponse> getResponse = restTemplate.getForEntity(
            "/api/v1/orders/" + orderId, OrderResponse.class);

        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
```

## Configuration Management

Use `application.yml` with profiles. Externalize secrets through environment variables.

```yaml
# application.yml
spring:
  application:
    name: order-service
  jpa:
    open-in-view: false  # always disable this -- it hides lazy loading issues
    hibernate:
      ddl-auto: validate  # never use "update" or "create" in production
    properties:
      hibernate:
        default_batch_fetch_size: 20
        order_inserts: true
        order_updates: true

server:
  port: 8080

---
# application-dev.yml
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:postgresql://localhost:5432/orders_dev
    username: dev
    password: dev
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true

---
# application-prod.yml
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: ${DATABASE_URL}
    username: ${DATABASE_USERNAME}
    password: ${DATABASE_PASSWORD}
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
```

Always set `spring.jpa.open-in-view=false`. The default (`true`) keeps the Hibernate session open during view rendering, hiding lazy loading problems that will surface under load.

## Common Pitfalls

1. **Field injection with `@Autowired`.** Use constructor injection. Field injection hides dependencies, breaks immutability, and makes unit testing harder.
2. **`open-in-view: true` (the default).** Disable it. It masks lazy-loading issues and causes unexpected queries during serialization.
3. **`ddl-auto: update` in production.** Use Flyway or Liquibase for schema management. Hibernate's auto-DDL is for development only.
4. **EAGER fetch on `@ManyToOne`.** Always set `fetch = FetchType.LAZY`. Use `JOIN FETCH` in JPQL when you need the association.
5. **Missing `@Transactional(readOnly = true)`.** Read-only transactions enable Hibernate optimizations (no dirty checking) and can route to read replicas.
6. **Catching exceptions in the service layer and returning null.** Let exceptions propagate to `@ControllerAdvice`. Returning null hides errors and makes debugging harder.
7. **Not using DTOs.** Never expose JPA entities directly in API responses. Entities change with schema migrations; DTOs provide a stable API contract.
