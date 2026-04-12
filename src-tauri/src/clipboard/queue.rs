use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use chrono;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    pub content: String,
    pub index: usize,      // Vị trí trong queue (1, 2, 3...)
    pub preview: String,   // 50 ký tự đầu
    pub collected_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QueueMode {
    Off,         // Chế độ bình thường
    Collecting,  // Đang thu thập items
    Pasting,     // Đang chờ để paste tuần tự
}

pub struct PasteQueue {
    pub items: Arc<Mutex<VecDeque<QueueItem>>>,
    pub mode: Arc<Mutex<QueueMode>>,
    pub total_collected: Arc<Mutex<usize>>,
}

impl PasteQueue {
    pub fn new() -> Self {
        Self {
            items: Arc::new(Mutex::new(VecDeque::new())),
            mode: Arc::new(Mutex::new(QueueMode::Off)),
            total_collected: Arc::new(Mutex::new(0)),
        }
    }

    pub fn get_mode(&self) -> QueueMode {
        self.mode.lock().unwrap().clone()
    }

    pub fn set_mode(&self, new_mode: QueueMode) {
        let mut mode = self.mode.lock().unwrap();
        *mode = new_mode;
    }

    pub fn start_collecting(&self) {
        self.set_mode(QueueMode::Collecting);
        self.items.lock().unwrap().clear();
        *self.total_collected.lock().unwrap() = 0;
    }

    pub fn add_item(&self, content: String) -> usize {
        let mut items = self.items.lock().unwrap();
        let mut total = self.total_collected.lock().unwrap();
        *total += 1;
        let index = *total;

        let preview: String = content.chars().take(50).collect();
        items.push_back(QueueItem {
            content,
            index,
            preview,
            collected_at: chrono::Local::now().to_rfc3339(),
        });

        index
    }

    pub fn finish_collecting(&self) {
        self.set_mode(QueueMode::Pasting);
    }

    pub fn pop_next(&self) -> Option<QueueItem> {
        let mut items = self.items.lock().unwrap();
        let item = items.pop_front();

        // Nếu hết items -> tự động về Off mode
        if items.is_empty() {
            self.set_mode(QueueMode::Off);
        }

        item
    }

    pub fn peek_all(&self) -> Vec<QueueItem> {
        self.items.lock().unwrap().iter().cloned().collect()
    }

    pub fn clear(&self) {
        self.items.lock().unwrap().clear();
        *self.total_collected.lock().unwrap() = 0;
        self.set_mode(QueueMode::Off);
    }

    pub fn remaining(&self) -> usize {
        self.items.lock().unwrap().len()
    }

    pub fn total(&self) -> usize {
        *self.total_collected.lock().unwrap()
    }
}
