import { useState } from 'react'
import './TabPanel.css'

function TabPanel({ tabs, activeTab: controlledActiveTab, onTabChange }) {
  const [internalActiveTab, setInternalActiveTab] = useState(0)

  // Use controlled tab if provided, otherwise use internal state
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab

  const handleTabClick = (index) => {
    if (onTabChange) {
      onTabChange(index)
    } else {
      setInternalActiveTab(index)
    }
  }

  return (
    <div className="tab-panel">
      <div className="tab-buttons">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`tab-button ${activeTab === index ? 'active' : ''}`}
            onClick={() => handleTabClick(index)}
            aria-selected={activeTab === index}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tabs[activeTab]?.content}
      </div>
    </div>
  )
}

export default TabPanel
