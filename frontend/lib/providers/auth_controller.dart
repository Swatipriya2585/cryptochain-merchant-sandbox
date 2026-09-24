import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Mock merchant session for the login / signup screens.
/// Not a full production auth system — any non-empty email + password succeeds.
class AuthController extends ChangeNotifier {
  bool isAuthenticated = false;
  String email = '';
  String name = '';

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    isAuthenticated = prefs.getBool('auth_logged_in') ?? false;
    email = prefs.getString('auth_email') ?? '';
    name = prefs.getString('auth_name') ?? '';
    notifyListeners();
  }

  Future<void> login({
    required String email,
    required String password,
    String? name,
  }) async {
    final trimmed = email.trim();
    if (trimmed.isEmpty || password.isEmpty) {
      throw StateError('Email and password are required');
    }
    this.email = trimmed;
    this.name = (name ?? '').trim().isEmpty ? trimmed.split('@').first : name!.trim();
    isAuthenticated = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('auth_logged_in', true);
    await prefs.setString('auth_email', this.email);
    await prefs.setString('auth_name', this.name);
    notifyListeners();
  }

  Future<void> signup({
    required String email,
    required String password,
    required String confirmPassword,
    String? name,
  }) async {
    if (password != confirmPassword) {
      throw StateError('Passwords do not match');
    }
    await login(email: email, password: password, name: name);
  }

  Future<void> logout() async {
    isAuthenticated = false;
    email = '';
    name = '';
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_logged_in');
    await prefs.remove('auth_email');
    await prefs.remove('auth_name');
    notifyListeners();
  }
}

final authController = AuthController();
