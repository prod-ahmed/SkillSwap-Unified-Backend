import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import {
  Session,
  SessionDocument,
  SessionStatus,
} from './entities/session.entity';
import { User, UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-type.enum';
import { RequestRescheduleDto } from './dto/request-reschedule.dto';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  // ✅ Create a new session (find student by email)
  async create(dto: CreateSessionDto, userId: string) {
    console.log('🔵 Creating session with teacherId:', userId);
    console.log('🔵 userId type:', typeof userId);
    console.log('🔵 userId length:', userId?.length);
    
    if (!userId || userId === 'undefined' || userId === 'null') {
      throw new BadRequestException('Invalid teacher user ID');
    }
    
    const teacherId = new Types.ObjectId(userId);
    console.log('🔵 teacherId ObjectId:', teacherId.toString());

    // Verify teacher exists
    const teacher = await this.userModel.findById(teacherId);
    console.log('🔵 Teacher found:', teacher ? teacher.username : 'NULL');
    
    if (!teacher) {
      throw new BadRequestException(`Teacher user not found with ID: ${userId}`);
    }

    // 🧠 Find student by email
    const student = await this.userModel.findOne({ email: dto.studentEmail });
    if (!student) {
      throw new BadRequestException('Student not found with this email');
    }

    const studentId = new Types.ObjectId(student._id);

    const session = new this.sessionModel({
      teacher: teacherId,
      student: studentId,
      title: dto.title,
      skill: dto.skill,
      date: dto.date,
      duration: dto.duration,
      status: dto.status ?? SessionStatus.UPCOMING,
      meetingLink: dto.meetingLink,
      notes: dto.notes,
    });

    const savedSession = await session.save();
    const populatedSession = await this.sessionModel
      .findById(savedSession._id)
      .populate('teacher', 'username email image')
      .populate('student', 'username email image')
      .exec();
    
    console.log('🔵 Populated session teacher:', populatedSession?.teacher);
    return populatedSession;
  }

  // ✅ Get all sessions for a given user (as teacher or student)
  async getUserSessions(userId: string) {
    const id = new Types.ObjectId(userId);
    return this.sessionModel
      .find({
        $or: [{ teacher: id }, { student: id }],
      })
      .populate('teacher', 'username email image')
      .populate('student', 'username email image')
      .sort({ date: -1 })
      .exec();
  }

  // ✅ Update session status
  async updateStatus(id: string, status: SessionStatus) {
    const session = await this.sessionModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .populate('teacher', 'username email image')
      .populate('student', 'username email image')
      .exec();

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return session;
  }

  // ✅ Update full session details
  async update(id: string, dto: UpdateSessionDto) {
    const session = await this.sessionModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('teacher', 'username email image')
      .populate('student', 'username email image')
      .exec();

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return session;
  }

  // ✅ Find all sessions (optional for admin)
  async findAll() {
    return this.sessionModel
      .find()
      .populate('teacher', 'username email')
      .populate('student', 'username email')
      .sort({ date: -1 });
  }

  // ✅ Remove a session
  async remove(id: string) {
    const deleted = await this.sessionModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return deleted;
  }

  async requestReschedule(sessionId: string, userId: string, dto: RequestRescheduleDto) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const requesterId = new Types.ObjectId(userId);
    const isTeacher = session.teacher.equals(requesterId);
    const isStudent = session.student.equals(requesterId);
    if (!isTeacher && !isStudent) {
      throw new BadRequestException('Vous ne participez pas à cette session');
    }

    const recipientId = isTeacher ? session.student : session.teacher;
    const requesterProfile = await this.userModel.findById(requesterId).select('username');

    const message =
      dto.message ??
      `${requesterProfile?.username ?? 'Un membre'} propose de reporter la session "${session.title}".`;

    await this.notificationsService.createNotification({
      userId: recipientId,
      type: NotificationType.RescheduleRequest,
      title: 'Proposition de report',
      message,
      sessionId: session._id,
      meetingUrl: dto.meetingLink ?? session.meetingLink,
      actionable: true,
      payload: {
        newDate: dto.newDate,
        newTime: dto.newTime ?? null,
        meetingLink: dto.meetingLink ?? session.meetingLink ?? null,
        requesterId: requesterId.toString(),
        requesterName: requesterProfile?.username ?? 'Un membre',
        newStatus: SessionStatus.UPCOMING,
      },
    });

    session.status = SessionStatus.POSTPONED;
    await session.save();

    return { success: true };
  }

  // ✅ Get session recommendations for user based on their skills to learn
  async getRecommendations(userId: string) {
    const currentUser = await this.userModel.findById(userId);
    if (!currentUser) {
      return { message: 'Recommendations', data: [] };
    }

    const skillsToLearn = currentUser.skillsLearn || [];
    
    // Find users who teach skills the current user wants to learn
    const potentialMentors = await this.userModel
      .find({
        _id: { $ne: userId },
        skillsTeach: { $in: skillsToLearn.length > 0 ? skillsToLearn : [/.*/] }
      })
      .limit(20)
      .lean()
      .exec();

    const recommendations = potentialMentors.map((mentor, index) => {
      const matchingSkills = (mentor.skillsTeach || []).filter(skill => 
        skillsToLearn.includes(skill)
      );
      
      return {
        id: mentor._id.toString(),
        mentorName: mentor.username || 'Utilisateur',
        mentorImage: mentor.image || null,
        age: 0,
        skills: matchingSkills.length > 0 ? matchingSkills : (mentor.skillsTeach || []),
        description: `${mentor.username} peut vous enseigner ${(mentor.skillsTeach || []).slice(0, 2).join(', ')}`,
        availability: 'Disponible',
        distance: `${(Math.random() * 10 + 0.5).toFixed(1)} km`,
        rating: Math.floor(Math.random() * 2) + 4,
        lastActive: 'Récemment',
        sessionsCount: Math.floor(Math.random() * 20) + 1,
      };
    });

    return { message: 'Recommendations', data: recommendations };
  }

  // ✅ Check availability for users at a given date/time
  async checkAvailability(emails: string[], date: Date, duration: number) {
    const results: Array<{
      user: { id: string; username: string; email: string; image?: string };
      available: boolean;
      message: string;
      conflictingSession: { title: string; date: Date } | null;
    }> = [];
    
    for (const email of emails) {
      const user = await this.userModel.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      
      if (!user) {
        continue;
      }
      
      // Check if user has any sessions that overlap with the requested time
      const endDate = new Date(date.getTime() + duration * 60000);
      
      const conflictingSession = await this.sessionModel.findOne({
        $or: [{ teacher: user._id }, { student: user._id }],
        status: SessionStatus.UPCOMING,
        date: {
          $lt: endDate,
          $gte: new Date(date.getTime() - duration * 60000),
        },
      });
      
      const isAvailable = !conflictingSession;
      
      results.push({
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          image: user.image,
        },
        available: isAvailable,
        message: isAvailable ? 'Disponible' : 'Occupé à cette heure',
        conflictingSession: conflictingSession ? {
          title: conflictingSession.title,
          date: conflictingSession.date,
        } : null,
      });
    }
    
    return { data: results };
  }
}
