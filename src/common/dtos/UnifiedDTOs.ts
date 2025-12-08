import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean } from 'class-validator';

// MARK: - Enums
export enum UserRole {
    STUDENT = 'student',
    TEACHER = 'teacher',
    ADMIN = 'admin',
}

// MARK: - Unified Create User DTO
export class CreateUnifiedUserDto {
    @IsString()
    @IsOptional() // Optional because Google Auth might provide it later
    name?: string;

    @IsEmail()
    email: string;

    @IsString()
    @IsOptional() // Optional for Google Auth users
    password?: string;

    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;

    // Fields from Backend 1 (SkillSwapTN-backend)
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @IsString()
    @IsOptional()
    location?: string;

    // Fields from Backend 2 (Google/AI)
    @IsString()
    @IsOptional()
    googleId?: string;

    @IsString()
    @IsOptional()
    avatarUrl?: string;

    @IsBoolean()
    @IsOptional()
    isEmailVerified?: boolean;
}

// MARK: - Unified Update User DTO
export class UpdateUnifiedUserDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    bio?: string;

    // Merged Preferences
    @IsBoolean()
    @IsOptional()
    notificationsEnabled?: boolean;

    @IsString()
    @IsOptional()
    preferredLanguage?: string;
}

// MARK: - Unified Session/Lesson DTO
export class CreateUnifiedSessionDto {
    @IsString()
    title: string;

    @IsString()
    description: string;

    @IsString()
    tutorId: string;

    @IsString()
    studentId: string;

    @IsString()
    startTime: string; // ISO Date

    // From Backend 1 (WebRTC)
    @IsBoolean()
    @IsOptional()
    isVideoCall?: boolean;

    // From Backend 2 (AI Lesson Plan)
    @IsString()
    @IsOptional()
    aiLessonPlanId?: string;
}
