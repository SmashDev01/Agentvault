
use near_sdk::{
    env,
    json_types::{U128, U64},
    near,
    AccountId,
    PanicOnDefault,
};

const DAY_NS: u64 = 86_400_000_000_000;
const MAX_REQUEST_HISTORY: usize = 100;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Policy {
    pub per_transaction_limit: u128,
    pub daily_budget: u128,
    pub approval_threshold: u128,
    pub expires_at_ns: u64,
    pub allowed_recipients: Vec<AccountId>,
}

#[near(serializers = [json])]
pub struct PolicyView {
    pub per_transaction_limit: U128,
    pub daily_budget: U128,
    pub approval_threshold: U128,
    pub expires_at_ns: U64,
    pub allowed_recipients: Vec<AccountId>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
pub enum RequestStatus {
    Approved,
    PendingApproval,
    Rejected,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct PaymentRequest {
    pub id: u64,
    pub requester: AccountId,
    pub recipient: AccountId,
    pub amount: u128,
    pub status: RequestStatus,
    pub created_at_ns: u64,
}

#[near(serializers = [json])]
pub struct PaymentRequestView {
    pub id: u64,
    pub requester: AccountId,
    pub recipient: AccountId,
    pub amount: U128,
    pub status: RequestStatus,
    pub created_at_ns: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AgentVault {
    owner_id: AccountId,
    policy: Policy,
    requests: Vec<PaymentRequest>,
    next_request_id: u64,
    daily_spent: u128,
    daily_spent_day: u64,
}

#[near]
impl AgentVault {
    #[init]
    pub fn new(
        owner_id: AccountId,
        per_transaction_limit: U128,
        daily_budget: U128,
        approval_threshold: U128,
        expires_at_ns: U64,
        allowed_recipients: Vec<AccountId>,
    ) -> Self {
        assert!(!env::state_exists(), "Already initialized");

        assert!(per_transaction_limit.0 > 0, "Invalid transaction limit");
        assert!(daily_budget.0 > 0, "Invalid daily budget");
        assert!(
            expires_at_ns.0 > env::block_timestamp(),
            "Expiry must be in the future"
        );

        Self {
            owner_id,
            policy: Policy {
                per_transaction_limit: per_transaction_limit.0,
                daily_budget: daily_budget.0,
                approval_threshold: approval_threshold.0,
                expires_at_ns: expires_at_ns.0,
                allowed_recipients,
            },
            requests: Vec::new(),
            next_request_id: 0,
            daily_spent: 0,
            daily_spent_day: env::block_timestamp() / DAY_NS,
        }
    }

    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the owner can perform this action"
        );
    }

    fn refresh_daily_spend(&mut self) {
        let today = env::block_timestamp() / DAY_NS;

        if today != self.daily_spent_day {
            self.daily_spent = 0;
            self.daily_spent_day = today;
        }
    }

    fn check_policy(&self, recipient: &AccountId, amount: u128) {
        assert!(
            env::block_timestamp() < self.policy.expires_at_ns,
            "Policy has expired"
        );

        assert!(amount > 0, "Amount must be greater than zero");

        assert!(
            amount <= self.policy.per_transaction_limit,
            "Transaction limit exceeded"
        );

        assert!(
            self.policy.allowed_recipients.contains(recipient),
            "Recipient is not allowed"
        );
    }

    pub fn update_policy(
        &mut self,
        per_transaction_limit: U128,
        daily_budget: U128,
        approval_threshold: U128,
        expires_at_ns: U64,
        allowed_recipients: Vec<AccountId>,
    ) {
        self.assert_owner();

        assert!(
            per_transaction_limit.0 > 0,
            "Invalid transaction limit"
        );

        assert!(daily_budget.0 > 0, "Invalid daily budget");

        assert!(
            expires_at_ns.0 > env::block_timestamp(),
            "Expiry must be in the future"
        );

        self.policy = Policy {
            per_transaction_limit: per_transaction_limit.0,
            daily_budget: daily_budget.0,
            approval_threshold: approval_threshold.0,
            expires_at_ns: expires_at_ns.0,
            allowed_recipients,
        };
    }

    pub fn submit_request(
        &mut self,
        recipient: AccountId,
        amount: U128,
    ) -> u64 {
        let amount = amount.0;

        self.refresh_daily_spend();
        self.check_policy(&recipient, amount);

        let remaining = self.policy.daily_budget
            .saturating_sub(self.daily_spent);

        assert!(
            amount <= remaining,
            "Daily spending budget exceeded"
        );

        let status = if amount > self.policy.approval_threshold {
            RequestStatus::PendingApproval
        } else {
            self.daily_spent += amount;
            RequestStatus::Approved
        };

        let id = self.next_request_id;
        self.next_request_id += 1;

        let request = PaymentRequest {
            id,
            requester: env::predecessor_account_id(),
            recipient,
            amount,
            status,
            created_at_ns: env::block_timestamp(),
        };

        if self.requests.len() >= MAX_REQUEST_HISTORY {
            self.requests.remove(0);
        }

        self.requests.push(request);

        id
    }

    pub fn approve_request(&mut self, request_id: u64) {
        self.assert_owner();
        self.refresh_daily_spend();

        let index = self.requests.iter()
            .position(|request| request.id == request_id)
            .expect("Request not found");

        let request = self.requests[index].clone();

        assert_eq!(
            request.status,
            RequestStatus::PendingApproval,
            "Request is not pending"
        );

        self.check_policy(&request.recipient, request.amount);

        assert!(
            request.amount <= self.policy.daily_budget
                .saturating_sub(self.daily_spent),
            "Daily spending budget exceeded"
        );

        self.daily_spent += request.amount;
        self.requests[index].status = RequestStatus::Approved;
    }

    pub fn reject_request(&mut self, request_id: u64) {
        self.assert_owner();

        let request = self.requests.iter_mut()
            .find(|request| request.id == request_id)
            .expect("Request not found");

        assert_eq!(
            request.status,
            RequestStatus::PendingApproval,
            "Request is not pending"
        );

        request.status = RequestStatus::Rejected;
    }

    pub fn get_policy(&self) -> PolicyView {
        PolicyView {
            per_transaction_limit: U128(self.policy.per_transaction_limit),
            daily_budget: U128(self.policy.daily_budget),
            approval_threshold: U128(self.policy.approval_threshold),
            expires_at_ns: U64(self.policy.expires_at_ns),
            allowed_recipients: self.policy.allowed_recipients.clone(),
        }
    }

    pub fn get_request(&self, request_id: u64) -> Option<PaymentRequestView> {
        self.requests.iter()
            .find(|request| request.id == request_id)
            .map(|request| PaymentRequestView {
                id: request.id,
                requester: request.requester.clone(),
                recipient: request.recipient.clone(),
                amount: U128(request.amount),
                status: request.status.clone(),
                created_at_ns: U64(request.created_at_ns),
            })
    }

    pub fn get_recent_requests(&self) -> Vec<PaymentRequestView> {
        self.requests.iter()
            .map(|request| PaymentRequestView {
                id: request.id,
                requester: request.requester.clone(),
                recipient: request.recipient.clone(),
                amount: U128(request.amount),
                status: request.status.clone(),
                created_at_ns: U64(request.created_at_ns),
            })
            .collect()
    }

    pub fn get_daily_spend(&self) -> U128 {
        let today = env::block_timestamp() / DAY_NS;

        if today == self.daily_spent_day {
            U128(self.daily_spent)
        } else {
            U128(0)
        }
    }

    // Read-only method to identify the contract owner.
    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }
}
