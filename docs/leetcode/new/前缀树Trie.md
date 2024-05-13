# Trie (前缀树)

## Trie (前缀树)

### 208. 实现 Trie (前缀树)

Trie（发音类似 "try"）或者说 前缀树 是一种树形数据结构，用于高效地存储和检索字符串数据集中的键。这一数据结构有相当多的应用情景，例如自动补完和拼写检查。

请你实现 Trie 类：

-   Trie() 初始化前缀树对象。
-   void insert(String word) 向前缀树中插入字符串 word 。
-   boolean search(String word) 如果字符串 word 在前缀树中，返回 true（即，在检索之前已经插入）；否则，返回 false 。
-   boolean startsWith(String prefix) 如果之前已经插入的字符串 word 的前缀之一为 prefix ，返回 true ；否则，返回 false 。

```java
class Trie {
    private final Node root = new Node();

    private static class Node {
        Node[] table = new Node[26];
        boolean isLeaf;
    }

    public void insert(String word) {
        Node n = root;
        for (char c : word.toCharArray()) {
            if (n.table[c - 'a'] == null)
                n.table[c - 'a'] = new Node();

            n = n.table[c - 'a'];
        }
        n.isLeaf = true;
    }

    public boolean search(String word) {
        Node n = root;
        for (char c : word.toCharArray()) {
            if (n.table[c - 'a'] == null) return false;
            n = n.table[c - 'a'];
        }
        return n.isLeaf;
    }

    public boolean startsWith(String prefix) {
        Node n = root;
        for (char c : prefix.toCharArray()) {
            if (n.table[c - 'a'] == null) return false;
            n = n.table[c - 'a'];
        }
        return true;
    }
}
```

## 查字典

### 648. 单词替换 mid

在英语中，我们有一个叫做 词根(root) 的概念，可以词根后面添加其他一些词组成另一个较长的单词——我们称这个词为 继承词(successor)。例如，词根 an，跟随着单词 other(其他)，可以形成新的单词 another(另一个)。

现在，给定一个由许多词根组成的词典 dictionary 和一个用空格分隔单词形成的句子 sentence。你需要将句子中的所有继承词用词根替换掉。如果继承词有许多可以形成它的词根，则用最短的词根替换它。

你需要输出替换之后的句子。

```java
class Solution {

    static class Node {
        Node[] table = new Node[26];
        boolean isLeaf;
    }

    // 词根树
    private final Node root = new Node();

    public String replaceWords(List<String> dictionary, String sentence) {
        for (String s : dictionary) {
            Node p = root;
            for (char c : s.toCharArray()) {
                if (p.table[c - 'a'] == null)
                    p.table[c - 'a'] = new Node();
                p = p.table[c - 'a'];
            }
            p.isLeaf = true;
        }
        StringBuilder sb = new StringBuilder();
        String[] words = sentence.split(" ");
        for (String w : words) {
            if (!sb.isEmpty()) sb.append(" ");
            sb.append(findRoot(w));
        }
        return sb.toString();
    }

    private String findRoot(String word) {
        Node p = root;
        int cnt = 0;
        for (char c : word.toCharArray()) {
            cnt++;
            if (p.table[c - 'a'] == null) return word;
            if (p.table[c - 'a'].isLeaf) return word.substring(0, cnt);
            p = p.table[c - 'a'];
        }
        return word;
    }
}
```
