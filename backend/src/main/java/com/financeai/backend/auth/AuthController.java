package com.financeai.backend.auth;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import com.financeai.backend.user.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordResetService passwordResetService;


    public AuthController(AuthenticationManager authenticationManager,
                          JwtUtil jwtUtil,
                          UserRepository userRepository,
                          UserService userService,
                          PasswordResetService passwordResetService) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.userService = userService;
        this.passwordResetService = passwordResetService;

    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = userService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        if (!authentication.isAuthenticated()) {
            throw new BadCredentialsException("Credenciais inválidas");
        }

        User user = userRepository.findByEmail(request.email())
            .orElseThrow(() -> new BadCredentialsException("Credenciais inválidas"));

        UUID userId = user.getId();
        String token = jwtUtil.generateToken(userId, user.getEmail());

        LoginResponse response = new LoginResponse(
            token,
            "Bearer",
            userId,
            user.getEmail(),
            86400000L
        );

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<GenericMessageResponse> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request
    ) {
        passwordResetService.requestPasswordReset(request.email());
        return ResponseEntity.ok(GenericMessageResponse.forgotPasswordDefault());
    }

    @PostMapping("/validate-reset-code")
    public ResponseEntity<ValidateResetCodeResponse> validateResetCode(
            @Valid @RequestBody ValidateResetCodeRequest request
    ) {
        ValidateResetCodeResponse response =
                passwordResetService.validateResetCode(request.email(), request.code());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<GenericMessageResponse> resetPassword(
            @RequestHeader("Authorization") String authorizationHeader,
            @Valid @RequestBody ResetPasswordRequest request
    ) {
        String resetToken = authorizationHeader.replaceFirst("(?i)^Bearer\\s+", "");
        passwordResetService.resetPassword(resetToken, request.newPassword());
        return ResponseEntity.ok(new GenericMessageResponse("Senha atualizada com sucesso."));
    }

}
