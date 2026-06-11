package com.razorfy.auth;

import com.razorfy.cashback.CashbackWallet;
import com.razorfy.cashback.CashbackWalletRepository;
import com.razorfy.common.BusinessException;
import com.razorfy.config.RazorfyProperties;
import com.razorfy.user.User;
import com.razorfy.user.UserRepository;
import com.razorfy.user.UserRole;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository users;
    private final CashbackWalletRepository wallets;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final RazorfyProperties properties;
    private final Clock clock;

    public AuthService(
            UserRepository users,
            CashbackWalletRepository wallets,
            PasswordEncoder passwordEncoder,
            JwtEncoder jwtEncoder,
            RazorfyProperties properties,
            Clock clock) {
        this.users = users;
        this.wallets = wallets;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (users.existsByEmailIgnoreCase(request.email())) {
            throw new BusinessException("EMAIL_ALREADY_EXISTS", "Já existe uma conta com este e-mail.", HttpStatus.CONFLICT);
        }
        if (users.existsByPhone(request.phone())) {
            throw new BusinessException("PHONE_ALREADY_EXISTS", "Já existe uma conta com este telefone.", HttpStatus.CONFLICT);
        }
        User user = users.save(new User(
                request.name().trim(),
                request.email().trim(),
                request.phone(),
                passwordEncoder.encode(request.password()),
                UserRole.CLIENT));
        wallets.save(new CashbackWallet(user));
        return tokenFor(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = users.findByEmailIgnoreCase(request.email())
                .orElseThrow(this::invalidCredentials);
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw invalidCredentials();
        }
        return tokenFor(user);
    }

    private AuthResponse tokenFor(User user) {
        Instant issuedAt = clock.instant();
        long hours = user.getRole() == UserRole.CLIENT
                ? properties.jwt().clientExpirationHours()
                : properties.jwt().staffExpirationHours();
        Instant expiresAt = issuedAt.plus(Duration.ofHours(hours));
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("razorfy")
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(user.getId().toString())
                .claim("name", user.getName())
                .claim("roles", List.of(user.getRole().name()))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AuthResponse(token, "Bearer", expiresAt, new UserView(
                user.getId().toString(), user.getName(), user.getEmail(), user.getPhone(), user.getRole().name()));
    }

    private BusinessException invalidCredentials() {
        return new BusinessException("INVALID_CREDENTIALS", "E-mail ou senha inválidos.", HttpStatus.UNAUTHORIZED);
    }
}
