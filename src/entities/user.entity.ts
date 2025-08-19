import { Entity, Column, PrimaryColumn } from "typeorm"
import { TrackInfo } from "../types"

@Entity()
export class User {
    @PrimaryColumn()
    id: string

    @Column()
    username: string

    @Column({
        type: 'time without time zone'
    })
    timeToNotify: string

    @Column({
        type: 'jsonb'
    })
    tracksInfo: Array<TrackInfo>
}
