  const handleSendMessage = useCallback(async (content: string, mode: string, imageUrl?: string) => {
    if (!content.trim() && !imageUrl) return; // Permite envio se tiver apenas imagem

    let chatId = currentChat?.id;

    // If authenticated, create chat in DB
    if (user) {
      if (!chatId) {
        const newChat = await createChat(mode);
        if (!newChat) {
          toast({
            title: "Erro",
            description: "Não foi possível criar a conversa",
            variant: "destructive",
          });
          return;
        }
        chatId = newChat.id;
      }

      // Add user message to DB (AGORA INCLUI A IMAGEM SE HOUVER)
      await addMessage("user", content, imageUrl ? "image" : "text", imageUrl);
      
      // Log activity
      await logActivity(`Mensagem enviada no modo ${mode}`, { preview: content.slice(0, 100) });
    } else {
      // Add to local state for non-authenticated users (AGORA INCLUI A IMAGEM SE HOUVER)
      const userMessage: Message = {
        id: Date.now().toString(),
        chat_id: "local",
        role: "user",
        content,
        type: imageUrl ? "image" : "text",
        media_url: imageUrl,
        created_at: new Date().toISOString(),
      };
      setLocalMessages(prev => [...prev, userMessage]);
    }

    setIsLoading(true);

    try {
      const config = modeConfig[mode] || modeConfig.chat;
      
      // Include personal context if available
      const personalContext = profile?.personal_context || "";
      const promptWithContext = personalContext 
        ? `[Contexto do usuário: ${personalContext}]\n\n${content}`
        : content;
      
      // ENVIA PARA A IA (O parâmetro image já estava aqui, o erro era que a mensagem local não tinha a imagem)
      const { data, error } = await supabase.functions.invoke(config.function, {
        body: { prompt: promptWithContext, image: imageUrl },
      });

      if (error) {
        throw new Error(error.message || "Erro ao processar requisição");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Add assistant message
      if (user && chatId) {
        await addMessage(
          "assistant",
          data.content,
          data.type || "text",
          data.mediaUrl
        );

        // Update chat title based on first message
        if (dbMessages.length === 0) {
          const title = content ? (content.slice(0, 50) + (content.length > 50 ? "..." : "")) : "Imagem Enviada";
          await updateChatTitle(chatId, title);
        }
      } else {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          chat_id: "local",
          role: "assistant",
          content: data.content,
          type: data.type || "text",
          media_url: data.mediaUrl,
          created_at: new Date().toISOString(),
        };
        setLocalMessages(prev => [...prev, assistantMessage]);
      }

    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });

      // Add error message
      const errorAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        chat_id: chatId || "local",
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${errorMessage}. Por favor, tente novamente.`,
        type: "text",
        created_at: new Date().toISOString(),
      };

      if (user && chatId) {
        await addMessage("assistant", errorAssistantMessage.content, "text");
      } else {
        setLocalMessages(prev => [...prev, errorAssistantMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, currentChat, createChat, addMessage, updateChatTitle, dbMessages, profile, toast, logActivity]);
