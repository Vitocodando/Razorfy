package com.razorfy.config;

import com.razorfy.user.User;
import com.razorfy.user.UserRepository;
import com.razorfy.user.UserRole;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DevelopmentBootstrap implements ApplicationRunner {

    private final RazorfyProperties properties;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public DevelopmentBootstrap(
            RazorfyProperties properties,
            UserRepository users,
            PasswordEncoder passwordEncoder) {
        this.properties = properties;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        RazorfyProperties.Bootstrap bootstrap = properties.bootstrap();
        if (!bootstrap.enabled()) return;

        if (bootstrap.adminPassword() != null && !bootstrap.adminPassword().isBlank()
                && users.findByEmailIgnoreCase(bootstrap.adminEmail()).isEmpty()) {
            users.save(new User(
                    "Administrador Razorfy",
                    bootstrap.adminEmail(),
                    "+5511999990099",
                    passwordEncoder.encode(bootstrap.adminPassword()),
                    UserRole.ADMIN));
        }

        if (bootstrap.staffPassword() != null && !bootstrap.staffPassword().isBlank()) {
            String encoded = passwordEncoder.encode(bootstrap.staffPassword());
            List<User> barbers = users.findAllByRoleOrderByName(UserRole.BARBER);
            barbers.forEach(barber -> barber.changePassword(encoded));
        }
    }
}
