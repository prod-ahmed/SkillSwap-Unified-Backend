# Backend Endpoints - Missing Features

## Quizzes Result Persistence

### POST /api/quizzes/results
Save quiz completion result

**Request:**
```json
{
  "skill": "JavaScript",
  "level": 3,
  "score": 8,
  "totalQuestions": 10,
  "answers": [
    {
      "question": "What is a closure?",
      "userAnswer": "A function with access to outer scope",
      "correct": true
    }
  ],
  "completedAt": "2025-12-14T02:00:00Z"
}
```

**Response:**
```json
{
  "id": "quiz_123",
  "userId": "user_456",
  "skill": "JavaScript",
  "score": 8,
  "totalQuestions": 10,
  "percentage": 80,
  "createdAt": "2025-12-14T02:00:00Z"
}
```

### GET /api/quizzes/results
Get user's quiz history

**Response:**
```json
{
  "results": [
    {
      "id": "quiz_123",
      "skill": "JavaScript",
      "score": 8,
      "totalQuestions": 10,
      "percentage": 80,
      "completedAt": "2025-12-14T02:00:00Z"
    }
  ],
  "stats": {
    "totalQuizzes": 10,
    "averageScore": 75,
    "topSkills": ["JavaScript", "Python"]
  }
}
```

---

## Google OAuth Authentication

### POST /api/auth/google
Authenticate with Google ID token

**Request:**
```json
{
  "idToken": "google_id_token_here",
  "referralCode": "optional_ref_code"
}
```

**Response:**
```json
{
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "user": {
    "id": "user_123",
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "profileImageUrl": "https://..."
  },
  "isNewUser": true
}
```

---

## Referral Code Validation

### GET /api/referrals/validate/:code
Validate a referral code and get inviter info

**Response:**
```json
{
  "valid": true,
  "code": "ABC123",
  "inviter": {
    "id": "user_456",
    "username": "JohnDoe",
    "firstName": "John",
    "profileImageUrl": "https://...",
    "skills": ["JavaScript", "React"]
  },
  "bonus": {
    "inviterPoints": 100,
    "inviteePoints": 50
  }
}
```

---

## Implementation Notes

### NestJS Controllers

#### QuizzesController
```typescript
@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  @Post('results')
  async saveResult(@Body() dto: CreateQuizResultDto, @Request() req) {
    return this.quizzesService.saveResult(req.user.id, dto);
  }

  @Get('results')
  async getResults(@Request() req) {
    return this.quizzesService.getUserResults(req.user.id);
  }
}
```

#### AuthController
```typescript
@Controller('auth')
export class AuthController {
  @Post('google')
  async googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.authenticateWithGoogle(dto.idToken, dto.referralCode);
  }
}
```

#### ReferralsController
```typescript
@Controller('referrals')
export class ReferralsController {
  @Get('validate/:code')
  async validateCode(@Param('code') code: string) {
    return this.referralsService.validateAndGetInviter(code);
  }
}
```

### MongoDB Schemas

#### QuizResult Schema
```typescript
export const QuizResultSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  skill: { type: String, required: true },
  level: { type: Number, required: true },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  answers: [{
    question: String,
    userAnswer: String,
    correct: Boolean
  }],
  completedAt: { type: Date, default: Date.now }
});
```

---

*This document should be shared with backend team for implementation*
