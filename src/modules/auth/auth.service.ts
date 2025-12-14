import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // 📝 Register a new user
  async register(dto: CreateUserDto, image?: string) {
    // Delegate to UsersService
    return this.usersService.createUser(dto, image);
  }

  // 🔑 Login user
  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { userId: user._id.toString(), role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  // 🔄 Refresh Token
  async refreshToken(user: any) {
    const payload = { userId: user.userId, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  // 🔐 Google OAuth Authentication
  async authenticateWithGoogle(dto: GoogleAuthDto) {
    try {
      // Verify Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new BadRequestException('Invalid Google token');
      }

      const { email, given_name, family_name, picture } = payload;

      // Check if user exists
      const existingUser = await this.usersService.findByEmail(email);

      if (existingUser) {
        // Existing user - generate JWT
        const jwtPayload = { userId: existingUser._id.toString(), role: existingUser.role };
        const accessToken = this.jwtService.sign(jwtPayload);

        return {
          accessToken,
          refreshToken: accessToken,
          user: {
            id: existingUser._id,
            email: existingUser.email,
            username: existingUser.username,
            profileImageUrl: (existingUser as any).profileImageUrl || picture,
          },
          isNewUser: false,
        };
      }

      // Create new user
      const username = given_name && family_name 
        ? `${given_name} ${family_name}`
        : given_name || email.split('@')[0];

      const createUserDto: CreateUserDto = {
        username,
        email: email,
        password: await bcrypt.hash(Math.random().toString(36), 10), // Random password
        referralCode: dto.referralCode,
      };

      const newUser: any = await this.usersService.createUser(createUserDto, picture);
      if (!newUser) {
        throw new BadRequestException('Failed to create user');
      }

      // Generate JWT for new user
      const jwtPayload = { userId: newUser._id.toString(), role: newUser.role };
      const accessToken = this.jwtService.sign(jwtPayload);

      return {
        accessToken,
        refreshToken: accessToken,
        user: {
          id: newUser._id,
          email: newUser.email,
          username: newUser.username,
          profileImageUrl: newUser.profileImageUrl || picture,
        },
        isNewUser: true,
      };
    } catch (error: any) {
      throw new UnauthorizedException('Google authentication failed: ' + error.message);
    }
  }
}
