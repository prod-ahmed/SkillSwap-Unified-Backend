import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/schemas/user.schema';

const mockUserModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
};
const mockMailService = {
  sendVerificationEmail: jest.fn(),
  sendReferralEmail: jest.fn(),
};
const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: MailService, useValue: mockMailService },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
