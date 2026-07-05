const mongoose = require('mongoose');

// Phase B: cumulative biographical profile per user.
// Updated by the session summariser after each conversation.
// Read by the greeting route to give Jeevani a persistent, growing understanding
// of who the user is and which life areas still need to be explored.

const CoveredDomainsSchema = new mongoose.Schema({
    childhood:     { type: String, default: 'none' },
    education:     { type: String, default: 'none' },
    relationships: { type: String, default: 'none' },
    career:        { type: String, default: 'none' },
    family:        { type: String, default: 'none' },
    failures:      { type: String, default: 'none' },
    values:        { type: String, default: 'none' },
    current_life:  { type: String, default: 'none' },
}, { _id: false });

const UserProfileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // Rolling 400-600 word portrait that grows/refines after every session.
    // Never loses information — the LLM merges rather than replaces.
    cumulativeProfile: {
        type: String,
        default: ''
    },
    // Depth rating per biographical domain so the greeting can target gaps.
    // Values: 'none' | 'low' | 'medium' | 'high'
    coveredDomains: {
        type: CoveredDomainsSchema,
        default: () => ({})
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);
