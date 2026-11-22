import { Router } from 'express';
import type { RequestHandler } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { clientIp, rateLimit } from '../../middleware/rate-limit';
import * as authController from './auth.controller';
import multer from 'multer';
import { HttpError } from '../../middleware/error-handler';

export const authRouter = Router();

/** Brute-force guards. Login is keyed by IP and by IP+email so one attacker
 *  cannot lock out other learners behind the same IP. */
const loginIpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  key: (req) => `auth:login:ip:${clientIp(req)}`,
  message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.',
});
const loginAccountLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => {
    const email = String((req.body as { email?: unknown } | undefined)?.email ?? '')
      .trim()
      .toLowerCase();
    return `auth:login:acct:${clientIp(req)}:${email || 'none'}`;
  },
  message: 'Sai mật khẩu quá nhiều lần cho tài khoản này. Vui lòng thử lại sau 15 phút.',
});
const registerIpLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  key: (req) => `auth:register:ip:${clientIp(req)}`,
  message: 'Đã tạo quá nhiều tài khoản trong thời gian ngắn. Vui lòng thử lại sau 1 giờ.',
});

const verifyOtpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  key: (req) => {
    const email = String((req.body as { email?: unknown } | undefined)?.email ?? '')
      .trim()
      .toLowerCase();
    return `auth:register:verify:${clientIp(req)}:${email || 'none'}`;
  },
  message: 'Quá nhiều lần nhập mã xác thực. Vui lòng thử lại sau 15 phút.',
});

const resendOtpLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: (req) => `auth:register:resend:${clientIp(req)}`,
  message: 'Đã yêu cầu gửi lại mã quá nhiều lần. Vui lòng thử lại sau 1 giờ.',
});

const socialIpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  key: (req) => `auth:social:ip:${clientIp(req)}`,
  message: 'Quá nhiều lần đăng nhập mạng xã hội. Vui lòng thử lại sau 15 phút.',
});

const avatarFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new HttpError(422, 'Avatar must be a JPEG, PNG or WebP image.', ['AVATAR_INVALID_TYPE']));
      return;
    }
    callback(null, true);
  },
}).single('avatar');

const parseAvatarFile: RequestHandler = (request, response, next) => {
  avatarFile(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new HttpError(413, 'Avatar image exceeds the 5 MB limit.', ['AVATAR_TOO_LARGE']));
      return;
    }
    next(error);
  });
};

authRouter.post('/register', registerIpLimit, authController.register);
// Web registration sends a six-digit code; `/register` above stays for the
// mobile client and any existing integration that has no mail step yet.
authRouter.post('/register/start', registerIpLimit, authController.startRegistration);
authRouter.post('/register/verify', verifyOtpLimit, authController.verifyRegistration);
authRouter.post('/register/resend', resendOtpLimit, authController.resendRegistrationOtp);
authRouter.post('/login', loginIpLimit, loginAccountLimit, authController.login);
authRouter.post('/google', socialIpLimit, authController.google);
authRouter.post('/facebook', socialIpLimit, authController.facebook);
authRouter.get('/providers', authController.providers);
authRouter.get('/providers/links', authenticate, authController.linkedProviders);
authRouter.post('/providers/:provider/link', authenticate, socialIpLimit, authController.linkProvider);
authRouter.delete('/providers/:provider', authenticate, authController.unlinkProvider);
authRouter.get('/me', authenticate, authController.me);
authRouter.patch('/profile', authenticate, authController.updateProfile);
authRouter.post('/avatar', authenticate, authController.ensureAvatarUploadConfigured, parseAvatarFile, authController.updateAvatar);
authRouter.patch('/password', authenticate, authController.changePassword);
