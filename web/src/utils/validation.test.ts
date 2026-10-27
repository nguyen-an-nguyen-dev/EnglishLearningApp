import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmail,
  validatePassword,
  validateName,
  validateRegistration,
  validateLogin,
} from './validation.ts';

describe('Auth Validation Utilities', () => {
  describe('validateEmail', () => {
    test('accepts valid email addresses', () => {
      assert.equal(validateEmail('test@example.com'), true);
      assert.equal(validateEmail('user.name+tag@sub.domain.co'), true);
    });

    test('rejects invalid email formats', () => {
      assert.equal(validateEmail(''), false);
      assert.equal(validateEmail('plainaddress'), false);
      assert.equal(validateEmail('@missingusername.com'), false);
      assert.equal(validateEmail('user@.com'), false);
    });
  });

  describe('validatePassword', () => {
    test('accepts passwords with 6 or more characters', () => {
      assert.equal(validatePassword('123456'), true);
      assert.equal(validatePassword('StrongPassword!'), true);
    });

    test('rejects passwords shorter than 6 characters', () => {
      assert.equal(validatePassword(''), false);
      assert.equal(validatePassword('12345'), false);
    });
  });

  describe('validateName', () => {
    test('accepts names with 2 or more characters', () => {
      assert.equal(validateName('An'), true);
      assert.equal(validateName('Nguyen Van An'), true);
    });

    test('rejects names shorter than 2 characters or blank', () => {
      assert.equal(validateName(''), false);
      assert.equal(validateName('A'), false);
      assert.equal(validateName('   '), false);
    });
  });

  describe('validateRegistration', () => {
    test('returns null when all fields are valid and passwords match', () => {
      const result = validateRegistration({
        name: 'An Nguyen',
        email: 'an@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      assert.equal(result, null);
    });

    test('returns error when password and confirmPassword do not match', () => {
      const result = validateRegistration({
        name: 'An Nguyen',
        email: 'an@example.com',
        password: 'password123',
        confirmPassword: 'differentPassword',
      });
      assert.equal(result, 'Mật khẩu xác nhận không khớp.');
    });

    test('returns error when name is too short', () => {
      const result = validateRegistration({
        name: 'A',
        email: 'an@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      assert.equal(result, 'Họ và tên phải có ít nhất 2 ký tự.');
    });

    test('returns error when email is invalid', () => {
      const result = validateRegistration({
        name: 'An Nguyen',
        email: 'invalid-email',
        password: 'password123',
        confirmPassword: 'password123',
      });
      assert.equal(result, 'Email không đúng định dạng.');
    });
  });

  describe('validateLogin', () => {
    test('returns null when email and password are provided and valid', () => {
      const result = validateLogin({
        email: 'an@example.com',
        password: 'password123',
      });
      assert.equal(result, null);
    });

    test('returns error when fields are empty', () => {
      const result = validateLogin({
        email: '',
        password: '',
      });
      assert.equal(result, 'Vui lòng nhập đầy đủ email và mật khẩu.');
    });
  });
});
