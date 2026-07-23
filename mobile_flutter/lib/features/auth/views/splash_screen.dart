import 'package:flutter/material.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              color: Color(0xFF6C5CE7),
            ),
            SizedBox(height: 16),
            Text(
              'Загрузка...',
              style: TextStyle(color: Colors.white60, fontSize: 14),
            )
          ],
        ),
      ),
    );
  }
}
