package com.laundry.management.washbatch.domain;

import com.laundry.management.auth.domain.*;
import com.laundry.management.order.domain.OrderItem;
import com.laundry.management.servicecatalog.domain.LaundryService;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name="wash_batches")
public class WashBatch {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="batch_code",nullable=false,unique=true,length=50) private String batchCode;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="branch_id") private Branch branch;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="service_id") private LaundryService service;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=30) private WashBatchStatus status;
    @Column(length=2000) private String note;
    @OneToMany(mappedBy="batch",cascade=CascadeType.ALL) @BatchSize(size=50) @OrderBy("id asc") private List<WashBatchItem> items=new ArrayList<>();
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="created_by",updatable=false) private UserAccount createdBy;
    @UpdateTimestamp @Column(name="updated_at",nullable=false) private Instant updatedAt;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="updated_by") private UserAccount updatedBy;
    @Column(name="ready_at") private Instant readyAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="ready_by") private UserAccount readyBy;
    @Column(name="cancelled_at") private Instant cancelledAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="cancelled_by") private UserAccount cancelledBy;
    @Column(name="cancel_reason",length=500) private String cancelReason;
    @Version @Column(nullable=false) private long version;

    protected WashBatch() {}
    public WashBatch(String code,Branch branch,LaundryService service,String note,UserAccount actor){this.batchCode=code;this.branch=branch;this.service=service;this.note=note;this.status=WashBatchStatus.DRAFT;this.createdBy=actor;this.updatedBy=actor;}
    public WashBatchItem addItem(OrderItem item,UserAccount actor){WashBatchItem membership=new WashBatchItem(this,item,actor);items.add(membership);return membership;}
    public void updateNote(String value,UserAccount actor,Instant now){note=value;touch(actor,now);}
    public void markReady(UserAccount actor,Instant now){status=WashBatchStatus.READY;readyAt=now;readyBy=actor;touch(actor,now);}
    public void cancel(String reason,UserAccount actor,Instant now){status=WashBatchStatus.CANCELLED;cancelReason=reason;cancelledAt=now;cancelledBy=actor;touch(actor,now);}
    public void touch(UserAccount actor,Instant now){updatedBy=actor;updatedAt=now;}
    public Long getId(){return id;} public String getBatchCode(){return batchCode;} public Branch getBranch(){return branch;} public LaundryService getService(){return service;}
    public WashBatchStatus getStatus(){return status;} public String getNote(){return note;} public List<WashBatchItem> getItems(){return List.copyOf(items);}
    public List<WashBatchItem> getActiveItems(){return items.stream().filter(WashBatchItem::isActive).toList();}
    public Instant getCreatedAt(){return createdAt;} public UserAccount getCreatedBy(){return createdBy;} public Instant getUpdatedAt(){return updatedAt;} public UserAccount getUpdatedBy(){return updatedBy;}
    public Instant getReadyAt(){return readyAt;} public UserAccount getReadyBy(){return readyBy;} public Instant getCancelledAt(){return cancelledAt;} public UserAccount getCancelledBy(){return cancelledBy;} public String getCancelReason(){return cancelReason;} public long getVersion(){return version;}
}
