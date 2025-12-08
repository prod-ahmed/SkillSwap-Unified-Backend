import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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
}
