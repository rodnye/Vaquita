import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiProperty({ description: 'User ID to invite' })
  @IsInt()
  inviteeId: number;
}
