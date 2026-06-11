package com.razorfy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RazorfyApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(RazorfyApiApplication.class, args);
	}

}
