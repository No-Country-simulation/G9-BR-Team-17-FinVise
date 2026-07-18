package com.financeai.backend.auth;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    public AuthController(AuthenticationManager authenticationManager,
                          JwtUtil jwtUtil,
                          UserRepository userRepository) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
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
}
