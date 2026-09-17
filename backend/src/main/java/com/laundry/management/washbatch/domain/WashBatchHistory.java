package com.laundry.management.washbatch.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name="wash_batch_history")
public class WashBatchHistory {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="wash_batch_id") private WashBatch batch;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=40) private WashBatchHistoryAction action;
    @Enumerated(EnumType.STRING) @Column(name="from_status",length=30) private WashBatchStatus fromStatus;
    @Enumerated(EnumType.STRING) @Column(name="to_status",length=30) private WashBatchStatus toStatus;
    @Column(length=500) private String reason;
    @Column(name="changed_fields_json",columnDefinition="TEXT") private String changedFieldsJson;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="actor_user_id") private UserAccount actor;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected WashBatchHistory() {}
    public WashBatchHistory(WashBatch batch,WashBatchHistoryAction action,WashBatchStatus from,WashBatchStatus to,String reason,String changed,UserAccount actor){this.batch=batch;this.action=action;this.fromStatus=from;this.toStatus=to;this.reason=reason;this.changedFieldsJson=changed;this.actor=actor;}
    public Long getId(){return id;} public WashBatchHistoryAction getAction(){return action;} public WashBatchStatus getFromStatus(){return fromStatus;} public WashBatchStatus getToStatus(){return toStatus;} public String getReason(){return reason;} public String getChangedFieldsJson(){return changedFieldsJson;} public UserAccount getActor(){return actor;} public Instant getCreatedAt(){return createdAt;}
}
